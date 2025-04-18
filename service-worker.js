// Constants
const BADGE_COLORS = {
    ON: '#008000',
    OFF: '#CCCCC0',
    WARN: '#FFA500'
};

class BadgeManager {
    static async updateBadge() {
        const setBadge = async (text, color) => {
            await chrome.action.setBadgeText({ text });
            await chrome.action.setBadgeBackgroundColor({ color });
        };

        const state = await StatusManager.getState();
        const ipConfig = await StatusManager.getHostIp();

        if (!ipConfig.hostIp) {
            await setBadge("!", BADGE_COLORS.WARN);
            ExtensionController.updateTooltip("Host IP not set.");
            return;
        }

        await setBadge(
            state ? "ON" : "OFF",
            state ? BADGE_COLORS.ON : BADGE_COLORS.OFF
        );
    }
}

// Status Management
class StatusManager {
    static async setState(state) {
        if (state === null) {
            const { enabled = false } = await chrome.storage.sync.get("enabled");
            state = enabled;
        }

        await chrome.storage.sync.set({ enabled: state });
        BadgeManager.updateBadge();
        console.log(`State set to: ${state}`);
    }

    static async getState() {
        const { enabled = false } = await chrome.storage.sync.get("enabled");
        return enabled;
    }

    static async getHostIp() {
        return await chrome.storage.sync.get("hostIp");
    }
}

// API Service
class APIService {
    static async sendData(endpoint, data) {
        const result = await StatusManager.getHostIp();
        if (!result.hostIp) {
            console.warn("Host IP is not set. Skipping data upload.");
            return false;
        }

        const API_BASE_URL = `http://${result.hostIp}:5000`;
        console.log(`Sending data to ${API_BASE_URL}/${endpoint}`);

        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                console.log(`${endpoint} successfully sent.`);
                return true;
            }
            console.error(`Failed to send ${endpoint}.`);
            return false;
        } catch (error) {
            console.error(`Error sending ${endpoint}:`, error);
            return false;
        }
    }
}

// Data Sync Manager
class DataSyncManager {
    static isSending = false;

    static async sendStoredData() {
        if (DataSyncManager.isSending) return;
        DataSyncManager.isSending = true;

        try {
            const { snippets = [], capturedPages = [] } = await chrome.storage.local.get([
                "snippets",
                "capturedPages"
            ]);

            if (snippets.length > 0) {
                const success = await APIService.sendData('snippet', snippets);
                if (success) await chrome.storage.local.set({ snippets: [] });
                else console.warn("Failed to send snippets. Retaining in storage.");
            }

            if (capturedPages.length > 0) {
                const success = await APIService.sendData('page', capturedPages);
                if (success) await chrome.storage.local.set({ capturedPages: [] });
                else console.warn("Failed to send captured pages. Retaining in storage.");
            }
        } finally {
            DataSyncManager.isSending = false;
        }
    }

    static async checkAlarmState() {
        const alarm = await chrome.alarms.get("sendStoredData");
        if (!alarm) {
            await chrome.alarms.create("sendStoredData", { periodInMinutes: 0.5 });
        }
    }
}

// Extension Controller
class ExtensionController {
    static async toggleExtension() {
        const prevState = await StatusManager.getState();
        const nextState = !prevState;

        await StatusManager.setState(nextState);
        await this.updateAllTabs();
    }

    static captureFullPage(tab) {
        chrome.tabs.sendMessage(tab.id, { action: "capturePage" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("Capture page response:", response);
            }
        });
    }

    static async updateTooltip(message) {
        if (message) {
            chrome.action.setTitle({ title: message });
            return;
        }

        const commands = await chrome.commands.getAll();
        const tooltipText = commands
            .filter(cmd => cmd.shortcut)
            .reduce((acc, cmd) =>
                acc + `${cmd.description}: ${cmd.shortcut}\n`,
                "Shortcuts:\n"
            );

        chrome.action.setTitle({ title: tooltipText });
    }

    static async reinjectContentScript() {
        for (const cs of chrome.runtime.getManifest().content_scripts) {
            for (const tab of await chrome.tabs.query({ url: cs.matches })) {
                if (tab.url.match(/(chrome|chrome-extension|edge|extension):\/\//gi)) {
                    continue;
                }
                const target = { tabId: tab.id, allFrames: cs.all_frames };
                if (cs.js && cs.js.length > 0) {
                    for (const file of cs.js) {
                        chrome.scripting.executeScript({
                            files: [file],
                            injectImmediately: cs.run_at === 'document_start',
                            world: cs.world,
                            target,
                        });
                    }
                }
            }
        }
    }

    static async updateAllTabs() {
        const state = await StatusManager.getState();

        for (const tab of await chrome.tabs.query({ url: "<all_urls>" })) {
            if (tab.url.match(/(chrome|chrome-extension|edge|extension):\/\//gi)) {
                continue;
            }

            chrome.tabs.sendMessage(tab.id, { refreshActive: { state } }, (_) => {
                if (chrome.runtime.lastError) {
                    console.warn(`Tab ${tab.id} did not receive the message: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`Tab ${tab.id} updated successfully.`);
                }
            });
        }
    }
}

// Initialization
function init() {
    StatusManager.setState(null);
    ExtensionController.updateTooltip();
    DataSyncManager.checkAlarmState();
    ExtensionController.reinjectContentScript();
}

// Event Listeners
chrome.runtime.onInstalled.addListener(async () => {
    init();
    chrome.runtime.openOptionsPage();
    console.log("Extension installed.");
});

chrome.runtime.onStartup.addListener(init);

chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === "toggle-extension") {
        ExtensionController.toggleExtension();
    } else if (command === "capture-page") {
        const state = await StatusManager.getState();
        if (state) {
            ExtensionController.captureFullPage(tab);
        }
    }
});

chrome.action.onClicked.addListener(async (_) => {
    const hostIp = await StatusManager.getHostIp();
    if (!hostIp.hostIp) {
        chrome.runtime.openOptionsPage();
        return;
    }
    ExtensionController.toggleExtension();
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "sendStoredData") {
        DataSyncManager.sendStoredData();
    }
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.hostIpChanged) {
        StatusManager.getHostIp().then(async (_) => {
            BadgeManager.updateBadge();
            sendResponse({ status: "Host IP updated across all tabs." });
        });
        return true;
    }
});

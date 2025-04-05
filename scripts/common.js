// Function to show a floating toast notification
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('div[data-toast]');
    if (existingToast) {
        document.body.removeChild(existingToast);
    }

    let toast = document.createElement('div');
    toast.setAttribute('data-toast', 'true');
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 15px';
    toast.style.borderRadius = '5px';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '10000';
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.5s ease-in-out';

    // Set styles based on message type
    switch (type.toLowerCase()) {
        case 'error':
            toast.style.background = 'rgba(220, 53, 69, 0.9)'; // red
            toast.style.color = 'white';
            break;
        case 'warning':
            toast.style.background = 'rgba(255, 193, 7, 0.9)'; // yellow
            toast.style.color = 'black';
            break;
        case 'info':
        default:
            toast.style.background = 'rgba(0, 0, 0, 0.8)'; // dark
            toast.style.color = 'white';
            break;
    }

    document.body.appendChild(toast);

    // Fade out and remove after 2 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            try {
                document.body.removeChild(toast);
            } catch (error) {
                // Ignore
            }
        }, 500);
    }, 2000);
}

function injectBlinkingLogo() {
    // Prevent multiple injections
    if (document.querySelector('[data-blinking-logo]')) return;

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('../images/icon.png');
    img.setAttribute('data-blinking-logo', 'true');
    img.style.position = 'fixed';
    img.style.top = '10px';
    img.style.right = '10px';
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.zIndex = '9999';
    img.style.animation = 'blink-animation 3s infinite';
    img.style.pointerEvents = 'none';

    const style = document.createElement('style');
    style.textContent = `
        @keyframes blink-animation {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(img);
}

function removeBlinkingLogo() {
    const logo = document.querySelector('[data-blinking-logo]');
    if (logo) logo.remove();
}

function injectCustomSelectionStyle() {
    const style = document.createElement('style');
    style.setAttribute('data-selection-style', 'true');
    style.textContent = `
        ::selection {
            background: #ACE2F9 !important; /* Light blue */
            color: black !important;
        }
    `;
    document.head.appendChild(style);
}

function removeCustomSelectionStyle() {
    const style = document.querySelector('[data-selection-style]');
    if (style) style.remove();
}

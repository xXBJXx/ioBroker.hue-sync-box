interface Window {
    registerSocketOnLoad?: (callback: () => void) => void;
    socketLoadedHandler?: () => void;
}

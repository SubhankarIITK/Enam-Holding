export const THEME_STORAGE_KEY = 'finn-theme';

// Run in the document head so a saved light preference is applied before paint.
export const themeBootstrap = `(function(){var theme;try{theme=localStorage.getItem('finn-theme')}catch(e){}if(theme!=='light'&&theme!=='dark'){theme=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();`;

(function () {
  // Colle ici l'URL Railway (Settings > Networking > Domain), sans slash final.
  // Exemple: https://bookmybeard-site-production-xxxx.up.railway.app
  var RAILWAY_API_URL = "https://bookmybeard-site-production.up.railway.app";

  var host = window.location.hostname;
  var isGitHubPages = host.endsWith(".github.io");

  if (!isGitHubPages) {
    return;
  }

  if (!RAILWAY_API_URL) {
    console.error(
      "[BookMyBeard] Configure RAILWAY_API_URL dans api-config.js avec ton domaine Railway."
    );
    return;
  }

  window.BOOKMYBEARD_API_URL = RAILWAY_API_URL.replace(/\/$/, "");
})();

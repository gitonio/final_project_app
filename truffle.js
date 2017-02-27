module.exports = {
  build: {
    "index.html": "index.html",
    "app.js": [
      "bower_components/angular/angular.js",
      "bower_components/angular-route/angular-route.js",
       "javascripts/app.js",
       "javascripts/utils.js",
       "javascripts/controllers/admin.js"    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    "images/": "images/",
    "views/": "views/",
    "directives/": "directives"
  },
  rpc: {
    host: "localhost",
    port: 8545
  },
  networks: {
    "net42": {
      network_id: 42
    }
  }
};

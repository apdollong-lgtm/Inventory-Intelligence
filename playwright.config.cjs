const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({testDir:'./browser-tests', use:{baseURL:'http://127.0.0.1:4173'}, webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:true}, reporter:'list'});

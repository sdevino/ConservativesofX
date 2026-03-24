const mysql = require('mysql2/promise');
const { DefaultAzureCredential } = require('@azure/identity');
require('dotenv').config();

const credential = new DefaultAzureCredential({
    managedIdentityClientId: '8c71e3ce-c42b-4614-9cb9-65d38de705d5'
});

async function getDbConnection() {
    try {
        const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');

        const config = {
            host: 'sql-scus-conservatives-web-001.mysql.database.azure.com',   // ← Updated hostname
            user: 'oidc-msi-927a',
            password: tokenResponse.token,
            database: 'db-scus-conservatives-web-001',
            port: parseInt(process.env.AZURE_MYSQL_PORT || '3306'),
            ssl: { rejectUnauthorized: true },
            connectTimeout: 15000,
            enableKeepAlive: true
        };

        const connection = await mysql.createConnection(config);
        console.log('✅ Successfully connected to Azure MySQL using Managed Identity');
        return connection;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        throw err;
    }
}

module.exports = { getDbConnection };
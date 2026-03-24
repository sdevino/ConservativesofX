const mysql = require('mysql2/promise');
const { DefaultAzureCredential } = require('@azure/identity');
require('dotenv').config();

const credential = process.env.AZURE_CLIENT_ID
  ? new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID })
  : new DefaultAzureCredential();

async function getDbConnection() {
  const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
  const config = {
    host: process.env.AZURE_MYSQL_HOST,
    user: process.env.AZURE_MYSQL_USER,
    password: tokenResponse.token,
    database: process.env.AZURE_MYSQL_DATABASE,
    port: parseInt(process.env.AZURE_MYSQL_PORT || '3306'),
    ssl: { rejectUnauthorized: true },
    connectTimeout: 10000
  };
  return mysql.createConnection(config);
}

module.exports = { getDbConnection };
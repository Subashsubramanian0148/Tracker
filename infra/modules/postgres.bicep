@description('Server name: globally unique, lowercase letters, digits and hyphens.')
param name string

param location string
param tags object

@description('Protect against accidental deletion with a CanNotDelete lock.')
param enableDeleteLock bool = true

param tenantId string
param logAnalyticsWorkspaceId string
param delegatedSubnetId string
param privateDnsZoneId string

@description('Database created for the application.')
param databaseName string

param administratorLogin string

@secure()
@description('Break-glass password login, required only when the server is first created (omitted on later deployments so the password is not reset). Store it in Key Vault (postgres-admin-password); day-to-day access uses Entra ID.')
param administratorLoginPassword string = ''

@description('Entra ID group that administers the server (object ID).')
param entraAdminObjectId string

@description('Display name of the Entra ID admin group.')
param entraAdminName string

@description('Compute SKU. Burstable B2ms is sufficient for < 50 users; use a GeneralPurpose SKU (e.g. Standard_D2ds_v5) for HA.')
param skuName string = 'Standard_B2ms'

@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'

@description('Zone-redundant HA (requires GeneralPurpose or MemoryOptimized tier; roughly doubles compute cost).')
param highAvailability bool = false

param storageSizeGB int = 32

@minValue(7)
@maxValue(35)
param backupRetentionDays int = 35

@description('pgaudit.log classes. Leave empty on the very first deployment: the pgaudit.* parameters only exist after the server has restarted with pgaudit in shared_preload_libraries. Then set e.g. "DDL,ROLE" and redeploy.')
param pgauditLogClasses string = ''

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: '17'
    administratorLogin: administratorLogin
    administratorLoginPassword: empty(administratorLoginPassword) ? null : administratorLoginPassword
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      // Password auth stays enabled for the application/migrator roles (DATABASE_URL). Human access uses Entra ID.
      passwordAuth: 'Enabled'
      tenantId: tenantId
    }
    network: {
      delegatedSubnetResourceId: delegatedSubnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    }
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: highAvailability ? 'ZoneRedundant' : 'Disabled'
    }
    maintenanceWindow: {
      customWindow: 'Enabled'
      dayOfWeek: 0
      startHour: 2
      startMinute: 0
    }
    // Encryption at rest with service-managed keys (AES-256). Switch to dataEncryption.type 'AzureKeyVault'
    // for customer-managed keys if your policy requires it (must be chosen at server creation).
  }
}

// Server parameters are applied one at a time: concurrent configuration writes fail with ServerBusy.
var baseConfigurations = [
  { name: 'require_secure_transport', value: 'on' }
  { name: 'ssl_min_protocol_version', value: 'TLSv1.2' }
  { name: 'log_connections', value: 'on' }
  { name: 'log_disconnections', value: 'on' }
  { name: 'log_checkpoints', value: 'on' }
  { name: 'log_lock_waits', value: 'on' }
  { name: 'connection_throttle.enable', value: 'on' }
  { name: 'azure.extensions', value: 'PGAUDIT,PG_STAT_STATEMENTS' }
  // Static parameter: takes effect after the next restart (see docs/DEPLOYMENT.md, "pgaudit").
  { name: 'shared_preload_libraries', value: 'pg_stat_statements,pgaudit' }
]

var pgauditConfigurations = empty(pgauditLogClasses)
  ? []
  : [
      { name: 'pgaudit.log', value: pgauditLogClasses }
      { name: 'pgaudit.log_relation', value: 'on' }
      { name: 'pgaudit.log_parameter', value: 'off' }
    ]

@batchSize(1)
resource configurations 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2025-08-01' = [
  for config in concat(baseConfigurations, pgauditConfigurations): {
    parent: server
    name: config.name
    properties: {
      value: config.value
      source: 'user-override'
    }
  }
]

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
  dependsOn: [configurations]
}

resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2025-08-01' = {
  parent: server
  name: entraAdminObjectId
  properties: {
    principalType: 'Group'
    principalName: entraAdminName
    tenantId: tenantId
  }
  dependsOn: [database]
}

resource deleteLock 'Microsoft.Authorization/locks@2020-05-01' = if (enableDeleteLock) {
  name: 'do-not-delete'
  scope: server
  properties: {
    level: 'CanNotDelete'
    notes: 'Holds audit-relevant data (2-year retention). Remove the lock deliberately before decommissioning.'
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: server
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output id string = server.id
output name string = server.name
output fqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = database.name

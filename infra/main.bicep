// ADO Metrics / Delivery Insights - Azure infrastructure (resource-group scope).
//
// Two-phase deployment (docs/DEPLOYMENT.md):
//   Phase 1  deployApp=false  network, monitoring, identities, ACR, Key Vault, PostgreSQL, change queue,
//                             Container Apps environment. Operators then set Key Vault secret values and
//                             the pipeline imports the first images.
//   Phase 2  deployApp=true   secret-scoped Key Vault access, Container App, migration job, optional
//                             Front Door, alerts.
//
// Naming: <appName>-<environmentName>-<resource>[-<suffix>]; globally unique names get a 5-char suffix
// derived from the subscription and resource group.

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------------------------

@description('Short application code used in resource names (lowercase letters/digits, 3-7 chars; keeps the Key Vault name within 24 chars).')
@minLength(3)
@maxLength(7)
param appName string = 'adom'

@allowed(['dev', 'test', 'staging', 'prod'])
param environmentName string

param location string = resourceGroup().location

@description('Owning team or distribution list, applied as the "owner" tag.')
param owner string

@description('Additional tags merged onto every resource.')
param extraTags object = {}

@description('false = Phase 1 (platform only). true = also deploy the app and migration job; requires the Key Vault secret values and images to exist.')
param deployApp bool = false

// ---------------------------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------------------------

param vnetAddressPrefix string = '10.60.0.0/22'
param containerAppsSubnetPrefix string = '10.60.0.0/23'
param privateEndpointSubnetPrefix string = '10.60.2.0/27'
param postgresSubnetPrefix string = '10.60.2.32/28'

@description('Tools subnet for the self-hosted CI runner used by smoke tests. Empty = not created.')
param toolsSubnetPrefix string = '10.60.3.0/27'

@description('Hub / DNS-resolver VNet IDs that also need the private DNS zones (so VPN users and on-prem DNS forwarders resolve private endpoints and the app).')
param dnsZoneLinkVnetIds array = []

@description('Custom DNS servers for the VNet (hub resolver). Empty = Azure-provided DNS.')
param dnsServers array = []

@description('Extra CIDRs allowed to reach PostgreSQL on 5432 (e.g. DBA VPN range).')
param postgresAdditionalSourcePrefixes array = []

@description('Optional CIDRs allowed through the app ingress (corporate VPN ranges). Empty = anything routed to the internal environment.')
param allowedIngressCidrs array = []

// ---------------------------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------------------------

@minValue(30)
@maxValue(730)
param logRetentionInDays int = 730

@description('Operational alert recipients. Empty = no alerts deployed.')
param alertEmailAddresses array = []

// ---------------------------------------------------------------------------------------------
// Key Vault
// ---------------------------------------------------------------------------------------------

@description('Operator egress IPs allowed to the Key Vault data plane (temporarily, to seed secrets from outside the VNet). Empty = private endpoint only.')
param keyVaultAllowedIpRanges array = []

@description('Users/groups that set secret values (Key Vault Secrets Officer).')
param keyVaultSecretsOfficerPrincipalIds array = []

// ---------------------------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------------------------

param postgresAdminLogin string = 'pgadmin'

@secure()
@description('Required on the first deployment only.')
param postgresAdminPassword string = ''

param postgresEntraAdminObjectId string
param postgresEntraAdminName string
param postgresSkuName string = 'Standard_B2ms'

@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param postgresSkuTier string = 'Burstable'

param postgresHighAvailability bool = false
param postgresStorageSizeGB int = 32

@description('pgaudit.log classes, e.g. "DDL,ROLE". Leave empty until the server has restarted once with pgaudit preloaded.')
param pgauditLogClasses string = ''

// ---------------------------------------------------------------------------------------------
// Change queue (Azure DevOps service hooks -> queue -> app)
// ---------------------------------------------------------------------------------------------

@allowed(['servicebus', 'storage'])
@description('servicebus (recommended): queue-scoped Send-only SAS or Entra sender. storage: Storage queue; the ADO consumer needs an ARM service connection or the full account key.')
param changeQueueKind string = 'servicebus'

@allowed(['sharedKey', 'serviceConnection'])
@description('How the ADO service hook authenticates. sharedKey = Send-only SAS rule (servicebus) / ACCOUNT KEY (storage). serviceConnection = ADO "Azure Resource Manager" service connection identity, granted sender RBAC on the queue only.')
param serviceHookAuthMode string = 'sharedKey'

@description('Principal ID of the ADO service connection identity (serviceHookAuthMode=serviceConnection).')
param serviceHookSenderPrincipalId string = ''

@allowed(['Standard', 'Premium'])
param serviceBusSku string = 'Standard'

param changeQueueName string = 'ado-changes'

// ---------------------------------------------------------------------------------------------
// Application (Phase 2)
// ---------------------------------------------------------------------------------------------

@description('Runtime image by digest, e.g. <acr>.azurecr.io/ado-metrics/runtime@sha256:... (required when deployApp=true).')
param runtimeImage string = ''

@description('Migrator image by digest (required when deployApp=true).')
param migratorImage string = ''

@description('Base URL users browse to, e.g. https://metrics.contoso.internal. Entra redirect URI = <this>/api/auth/callback.')
param publicBaseUrl string

param entraTenantId string = tenant().tenantId
param entraClientId string

@description('Azure DevOps organization URL, e.g. https://dev.azure.com/contoso.')
param adoOrgUrl string

@description('Optional comma-separated project list. Empty = all projects the identity can read.')
param adoProjects string = ''

@allowed(['debug', 'info', 'warn', 'error'])
param logLevel string = 'info'

param syncIntervalMinutes int = 15
param dataRetentionDays int = 730
param webhookBasicUser string = 'ado-service-hook'
param minReplicas int = 1
param maxReplicas int = 3
param containerAppsZoneRedundant bool = false

@description('Custom domain bound to the app (e.g. metrics.contoso.internal). Empty = default *.azurecontainerapps.io FQDN.')
param customDomainName string = ''

@description('Name of the Key Vault certificate (PFX, imported into Key Vault) for customDomainName.')
param customDomainCertificateName string = ''

// ---------------------------------------------------------------------------------------------
// Optional edge (Front Door Premium + WAF via Private Link)
// ---------------------------------------------------------------------------------------------

param enableFrontDoor bool = false
param frontDoorRateLimitPerMinute int = 300
param frontDoorAllowedCountryCodes array = []

// ---------------------------------------------------------------------------------------------
// CI/CD (GitHub OIDC)
// ---------------------------------------------------------------------------------------------

@description('owner/repo allowed to deploy via OIDC. Empty = no deployer identity.')
param githubRepository string = ''

@description('GitHub environment bound to this Azure environment (e.g. staging, production).')
param githubEnvironment string = ''

// =============================================================================================

var prefix = '${appName}-${environmentName}'
var suffix = take(uniqueString(subscription().id, resourceGroup().id, appName, environmentName), 5)
var compactPrefix = replace(prefix, '-', '')

var tags = union(
  {
    app: 'ado-metrics'
    env: environmentName
    owner: owner
    dataClassification: 'Confidential'
    managedBy: 'bicep'
  },
  extraTags
)

var names = {
  logAnalytics: '${prefix}-log'
  registry: '${compactPrefix}acr${suffix}'
  keyVault: '${prefix}-kv-${suffix}'
  postgres: '${prefix}-psql-${suffix}'
  serviceBus: '${prefix}-sb-${suffix}'
  storage: '${compactPrefix}st${suffix}'
  environment: '${prefix}-cae'
  app: '${prefix}-app'
  migrationJob: '${prefix}-job-migrate'
  wafPolicy: '${compactPrefix}waf'
}

// Secret NAMES only. Values are set out-of-band (docs/DEPLOYMENT.md) and never pass through templates.
var secretNames = {
  databaseUrl: 'database-url'
  migratorDatabaseUrl: 'migrator-database-url'
  sessionSecret: 'session-secret'
  entraClientSecret: 'entra-client-secret'
  webhookBasicPassword: 'webhook-basic-password'
  postgresAdminPassword: 'postgres-admin-password'
}

var appSecretEnvironmentVariables = [
  { name: 'DATABASE_URL', secretName: secretNames.databaseUrl }
  { name: 'SESSION_SECRET', secretName: secretNames.sessionSecret }
  { name: 'ENTRA_CLIENT_SECRET', secretName: secretNames.entraClientSecret }
  { name: 'WEBHOOK_BASIC_PASSWORD', secretName: secretNames.webhookBasicPassword }
]

var useServiceBus = changeQueueKind == 'servicebus'
var useServiceBusPrivateEndpoint = useServiceBus && serviceBusSku == 'Premium'
var serviceHookSender = serviceHookAuthMode == 'serviceConnection' ? serviceHookSenderPrincipalId : ''

// ---------------------------------------------------------------------------------------------
// Foundation
// ---------------------------------------------------------------------------------------------

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    name: names.logAnalytics
    location: location
    tags: tags
    retentionInDays: logRetentionInDays
  }
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    prefix: prefix
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    addressPrefix: vnetAddressPrefix
    containerAppsSubnetPrefix: containerAppsSubnetPrefix
    privateEndpointSubnetPrefix: privateEndpointSubnetPrefix
    postgresSubnetPrefix: postgresSubnetPrefix
    toolsSubnetPrefix: toolsSubnetPrefix
    postgresAdditionalSourcePrefixes: postgresAdditionalSourcePrefixes
    dnsServers: dnsServers
  }
}

var dnsLinkVnetIds = concat([network.outputs.vnetId], dnsZoneLinkVnetIds)

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    prefix: prefix
    location: location
    tags: tags
    githubRepository: githubRepository
    githubEnvironment: githubEnvironment
  }
}

module deployerRole 'modules/deployer-role.bicep' = if (!empty(githubRepository) && !empty(githubEnvironment)) {
  name: 'deployer-role'
  params: {
    prefix: prefix
    principalId: identity.outputs.deployerPrincipalId
  }
}

// ---------------------------------------------------------------------------------------------
// Private DNS
// ---------------------------------------------------------------------------------------------

module keyVaultDns 'modules/private-dns-zone.bicep' = {
  name: 'dns-keyvault'
  params: {
    zoneName: 'privatelink.vaultcore.azure.net'
    tags: tags
    vnetIds: dnsLinkVnetIds
  }
}

module registryDns 'modules/private-dns-zone.bicep' = {
  name: 'dns-registry'
  params: {
    zoneName: 'privatelink.azurecr.io'
    tags: tags
    vnetIds: dnsLinkVnetIds
  }
}

module postgresDns 'modules/private-dns-zone.bicep' = {
  name: 'dns-postgres'
  params: {
    zoneName: '${prefix}.private.postgres.database.azure.com'
    tags: tags
    vnetIds: dnsLinkVnetIds
  }
}

module serviceBusDns 'modules/private-dns-zone.bicep' = if (useServiceBusPrivateEndpoint) {
  name: 'dns-servicebus'
  params: {
    zoneName: 'privatelink.servicebus.windows.net'
    tags: tags
    vnetIds: dnsLinkVnetIds
  }
}

module queueDns 'modules/private-dns-zone.bicep' = if (!useServiceBus) {
  name: 'dns-queue'
  params: {
    zoneName: 'privatelink.queue.core.windows.net'
    tags: tags
    vnetIds: dnsLinkVnetIds
  }
}

// ---------------------------------------------------------------------------------------------
// Data and secrets
// ---------------------------------------------------------------------------------------------

module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    name: names.registry
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: registryDns.outputs.id
    pullPrincipalIds: [
      identity.outputs.appIdentityPrincipalId
      identity.outputs.migratorIdentityPrincipalId
    ]
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault'
  params: {
    name: names.keyVault
    location: location
    tags: tags
    enableDeleteLock: environmentName == 'prod'
    tenantId: tenant().tenantId
    logAnalyticsWorkspaceId: monitoring.outputs.id
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: keyVaultDns.outputs.id
    allowedIpRanges: keyVaultAllowedIpRanges
    secretsOfficerPrincipalIds: keyVaultSecretsOfficerPrincipalIds
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    name: names.postgres
    location: location
    tags: tags
    enableDeleteLock: environmentName == 'prod'
    tenantId: tenant().tenantId
    logAnalyticsWorkspaceId: monitoring.outputs.id
    delegatedSubnetId: network.outputs.postgresSubnetId
    privateDnsZoneId: postgresDns.outputs.id
    databaseName: 'ado_metrics'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    entraAdminObjectId: postgresEntraAdminObjectId
    entraAdminName: postgresEntraAdminName
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    highAvailability: postgresHighAvailability
    storageSizeGB: postgresStorageSizeGB
    pgauditLogClasses: pgauditLogClasses
  }
}

module serviceBus 'modules/service-bus.bicep' = if (useServiceBus) {
  name: 'service-bus'
  params: {
    name: names.serviceBus
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    queueName: changeQueueName
    sku: serviceBusSku
    enableServiceHookSasRule: serviceHookAuthMode == 'sharedKey'
    serviceHookSenderPrincipalId: serviceHookSender
    receiverPrincipalId: identity.outputs.appIdentityPrincipalId
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: useServiceBusPrivateEndpoint ? serviceBusDns.outputs.id : ''
  }
}

module storageQueue 'modules/storage-queue.bicep' = if (!useServiceBus) {
  name: 'storage-queue'
  params: {
    name: names.storage
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: !useServiceBus ? queueDns.outputs.id : ''
    queueName: changeQueueName
    allowSharedKeyAccess: serviceHookAuthMode == 'sharedKey'
    serviceHookSenderPrincipalId: serviceHookSender
    receiverPrincipalId: identity.outputs.appIdentityPrincipalId
  }
}

var changeQueueUrl = useServiceBus ? serviceBus.outputs.queueUrl : storageQueue.outputs.queueUrl

// ---------------------------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------------------------

module containerAppsEnvironment 'modules/container-apps-env.bicep' = {
  name: 'container-apps-env'
  params: {
    name: names.environment
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    infrastructureSubnetId: network.outputs.containerAppsSubnetId
    dnsLinkVnetIds: dnsLinkVnetIds
    identityId: identity.outputs.appIdentityId
    zoneRedundant: containerAppsZoneRedundant
    disablePublicNetworkAccess: enableFrontDoor
  }
}

// Phase 2 ---------------------------------------------------------------------------------------

var customDomainSecretNames = empty(customDomainCertificateName) ? [] : [customDomainCertificateName]

module appSecretAccess 'modules/key-vault-secret-access.bicep' = if (deployApp) {
  name: 'kv-access-app'
  params: {
    keyVaultName: keyVault.outputs.name
    secretNames: concat(map(appSecretEnvironmentVariables, item => item.secretName), customDomainSecretNames)
    principalId: identity.outputs.appIdentityPrincipalId
  }
}

module migratorSecretAccess 'modules/key-vault-secret-access.bicep' = if (deployApp) {
  name: 'kv-access-migrator'
  params: {
    keyVaultName: keyVault.outputs.name
    secretNames: [secretNames.migratorDatabaseUrl]
    principalId: identity.outputs.migratorIdentityPrincipalId
  }
}

var appEnvironmentVariables = concat(
  [
    { name: 'NODE_ENV', value: 'production' }
    { name: 'PORT', value: '3000' }
    { name: 'LOG_LEVEL', value: logLevel }
    { name: 'PUBLIC_BASE_URL', value: publicBaseUrl }
    // Client -> [Front Door ->] Container Apps ingress (Envoy) -> app.
    { name: 'TRUST_PROXY_HOPS', value: enableFrontDoor ? '2' : '1' }
    { name: 'AUTH_MODE', value: 'entra' }
    { name: 'ENTRA_TENANT_ID', value: entraTenantId }
    { name: 'ENTRA_CLIENT_ID', value: entraClientId }
    { name: 'ADO_ORG_URL', value: adoOrgUrl }
    { name: 'ADO_AUTH', value: 'managed-identity' }
    { name: 'AZURE_CLIENT_ID', value: identity.outputs.appIdentityClientId }
    { name: 'SYNC_INTERVAL_MINUTES', value: string(syncIntervalMinutes) }
    { name: 'RETENTION_DAYS', value: string(dataRetentionDays) }
    { name: 'WEBHOOK_BASIC_USER', value: webhookBasicUser }
    { name: 'CHANGE_QUEUE_KIND', value: changeQueueKind }
    { name: 'CHANGE_QUEUE_URL', value: changeQueueUrl }
  ],
  empty(adoProjects) ? [] : [{ name: 'ADO_PROJECTS', value: adoProjects }]
)

module app 'modules/container-app.bicep' = if (deployApp) {
  name: 'container-app'
  params: {
    name: names.app
    location: location
    tags: tags
    environmentId: containerAppsEnvironment.outputs.id
    environmentName: containerAppsEnvironment.outputs.name
    identityId: identity.outputs.appIdentityId
    registryLoginServer: registry.outputs.loginServer
    keyVaultUri: keyVault.outputs.uri
    image: runtimeImage
    environmentVariables: appEnvironmentVariables
    secretEnvironmentVariables: appSecretEnvironmentVariables
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    allowedIngressCidrs: allowedIngressCidrs
    customDomainName: customDomainName
    customDomainCertificateSecretUri: empty(customDomainCertificateName) ? '' : '${keyVault.outputs.uri}secrets/${customDomainCertificateName}'
  }
  dependsOn: [appSecretAccess]
}

module migrationJob 'modules/migration-job.bicep' = if (deployApp) {
  name: 'migration-job'
  params: {
    name: names.migrationJob
    location: location
    tags: tags
    environmentId: containerAppsEnvironment.outputs.id
    identityId: identity.outputs.migratorIdentityId
    registryLoginServer: registry.outputs.loginServer
    keyVaultUri: keyVault.outputs.uri
    databaseUrlSecretName: secretNames.migratorDatabaseUrl
    image: migratorImage
  }
  dependsOn: [migratorSecretAccess]
}

module frontDoor 'modules/front-door.bicep' = if (deployApp && enableFrontDoor) {
  name: 'front-door'
  params: {
    prefix: prefix
    wafPolicyName: names.wafPolicy
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.id
    originLocation: location
    environmentId: containerAppsEnvironment.outputs.id
    originHostName: deployApp ? app.outputs.fqdn : ''
    rateLimitPerMinute: frontDoorRateLimitPerMinute
    allowedCountryCodes: frontDoorAllowedCountryCodes
  }
}

module alerts 'modules/alerts.bicep' = if (deployApp && !empty(alertEmailAddresses)) {
  name: 'alerts'
  params: {
    prefix: prefix
    tags: tags
    emailAddresses: alertEmailAddresses
    containerAppId: deployApp ? app.outputs.id : ''
    postgresServerId: postgres.outputs.id
    serviceBusNamespaceId: useServiceBus ? serviceBus.outputs.namespaceId : ''
  }
}

// =============================================================================================
// Outputs (no secrets)
// =============================================================================================

output appInternalFqdn string = deployApp ? app.outputs.fqdn : ''
output environmentDefaultDomain string = containerAppsEnvironment.outputs.defaultDomain
output environmentStaticIp string = containerAppsEnvironment.outputs.staticIp
output acrLoginServer string = registry.outputs.loginServer
output keyVaultName string = keyVault.outputs.name
output keyVaultUri string = keyVault.outputs.uri
output appIdentityClientId string = identity.outputs.appIdentityClientId
output appIdentityPrincipalId string = identity.outputs.appIdentityPrincipalId
output appIdentityName string = identity.outputs.appIdentityName
output postgresFqdn string = postgres.outputs.fqdn
output postgresDatabaseName string = postgres.outputs.databaseName
output changeQueueKind string = changeQueueKind
output changeQueueUrl string = changeQueueUrl
output serviceHookSasRuleName string = useServiceBus ? serviceBus.outputs.serviceHookSasRuleName : ''
output frontDoorEndpointHostName string = deployApp && enableFrontDoor ? frontDoor.outputs.endpointHostName : ''

@description('Key Vault secrets that must exist (with values) before Phase 2.')
output requiredKeyVaultSecrets array = [
  secretNames.databaseUrl
  secretNames.migratorDatabaseUrl
  secretNames.sessionSecret
  secretNames.entraClientSecret
  secretNames.webhookBasicPassword
]

@description('Values for the matching GitHub environment\'s variables (deploy workflow).')
output githubEnvironmentVariables object = {
  AZURE_CLIENT_ID: identity.outputs.deployerClientId
  AZURE_TENANT_ID: tenant().tenantId
  AZURE_SUBSCRIPTION_ID: subscription().subscriptionId
  AZURE_RESOURCE_GROUP: resourceGroup().name
  ACR_NAME: registry.outputs.name
  CONTAINER_APP_NAME: names.app
  MIGRATION_JOB_NAME: names.migrationJob
}

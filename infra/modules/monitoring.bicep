@description('Log Analytics workspace name.')
param name string

param location string
param tags object

@description('Interactive retention in days. 730 covers the 2-year audit/retention requirement. Retention beyond the 31 free days is billed per GB-month.')
@minValue(30)
@maxValue(730)
param retentionInDays int = 730

@description('Daily ingestion cap in GB (-1 = no cap). A cap protects cost but drops logs once reached; keep -1 in production for audit completeness.')
param dailyQuotaGb int = -1

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
    features: {
      // Ingestion only through Entra-authenticated pipelines (diagnostic settings / AMA), no shared keys.
      disableLocalAuth: true
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Query audit: who ran which query against the workspace (ISO 27001 A.8.15 / SOC 2 CC7.2 evidence).
resource workspaceDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: workspace
  properties: {
    workspaceId: workspace.id
    logs: [
      {
        categoryGroup: 'audit'
        enabled: true
      }
    ]
  }
}

output id string = workspace.id
output name string = workspace.name
output customerId string = workspace.properties.customerId

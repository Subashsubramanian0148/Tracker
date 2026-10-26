// Baseline operational alerts (SOC 2 CC7.2 / ISO 27001 A.8.16). Deployed when alert recipients are set.

param prefix string
param tags object

@description('E-mail recipients of the action group.')
param emailAddresses array

param containerAppId string
param postgresServerId string

@description('Service Bus namespace ID (empty when the storage queue is used).')
param serviceBusNamespaceId string = ''

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${prefix}-ag-ops'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: take(replace('${prefix}ops', '-', ''), 12)
    enabled: true
    emailReceivers: [
      for (address, i) in emailAddresses: {
        name: 'email-${i}'
        emailAddress: address
        useCommonAlertSchema: true
      }
    ]
  }
}

var alertDefinitions = concat(
  [
    {
      name: '${prefix}-alert-app-5xx'
      description: 'Container App returned more than 10 server errors in 5 minutes.'
      scope: containerAppId
      severity: 2
      window: 'PT5M'
      criterion: {
        name: 'server-errors'
        criterionType: 'StaticThresholdCriterion'
        metricName: 'Requests'
        metricNamespace: 'Microsoft.App/containerApps'
        dimensions: [
          {
            name: 'statusCodeCategory'
            operator: 'Include'
            values: ['5xx']
          }
        ]
        operator: 'GreaterThan'
        threshold: 10
        timeAggregation: 'Total'
      }
    }
    {
      name: '${prefix}-alert-app-restarts'
      description: 'Container App replicas restarted more than 3 times in 15 minutes (failing liveness probes or crashes).'
      scope: containerAppId
      severity: 2
      window: 'PT15M'
      criterion: {
        name: 'restarts'
        criterionType: 'StaticThresholdCriterion'
        metricName: 'RestartCount'
        metricNamespace: 'Microsoft.App/containerApps'
        operator: 'GreaterThan'
        threshold: 3
        timeAggregation: 'Total'
      }
    }
    {
      name: '${prefix}-alert-psql-cpu'
      description: 'PostgreSQL CPU above 80% for 15 minutes.'
      scope: postgresServerId
      severity: 3
      window: 'PT15M'
      criterion: {
        name: 'cpu'
        criterionType: 'StaticThresholdCriterion'
        metricName: 'cpu_percent'
        metricNamespace: 'Microsoft.DBforPostgreSQL/flexibleServers'
        operator: 'GreaterThan'
        threshold: 80
        timeAggregation: 'Average'
      }
    }
    {
      name: '${prefix}-alert-psql-storage'
      description: 'PostgreSQL storage above 85%.'
      scope: postgresServerId
      severity: 2
      window: 'PT30M'
      criterion: {
        name: 'storage'
        criterionType: 'StaticThresholdCriterion'
        metricName: 'storage_percent'
        metricNamespace: 'Microsoft.DBforPostgreSQL/flexibleServers'
        operator: 'GreaterThan'
        threshold: 85
        timeAggregation: 'Average'
      }
    }
  ],
  empty(serviceBusNamespaceId)
    ? []
    : [
        {
          name: '${prefix}-alert-sb-deadletter'
          description: 'Change-queue messages were dead-lettered (the app failed to process them 10 times).'
          scope: serviceBusNamespaceId
          severity: 3
          window: 'PT15M'
          criterion: {
            name: 'deadletter'
            criterionType: 'StaticThresholdCriterion'
            metricName: 'DeadletteredMessages'
            metricNamespace: 'Microsoft.ServiceBus/namespaces'
            operator: 'GreaterThan'
            threshold: 0
            timeAggregation: 'Maximum'
          }
        }
      ]
)

resource metricAlerts 'Microsoft.Insights/metricAlerts@2018-03-01' = [
  for alert in alertDefinitions: {
    name: alert.name
    location: 'global'
    tags: tags
    properties: {
      description: alert.description
      severity: alert.severity
      enabled: true
      scopes: [alert.scope]
      evaluationFrequency: 'PT5M'
      windowSize: alert.window
      autoMitigate: true
      criteria: {
        'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
        allOf: [alert.criterion]
      }
      actions: [
        {
          actionGroupId: actionGroup.id
        }
      ]
    }
  }
]

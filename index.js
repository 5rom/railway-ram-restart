const { gql, GraphQLClient } = require('graphql-request')
const { Cron } = require("croner");
require('dotenv').config();

// Suppress punycode deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
        return;
    }
    console.warn(warning);
});

const ENDPOINT = 'https://backboard.railway.app/graphql/v2';

const graphqlClient = new GraphQLClient(ENDPOINT, {
    headers: {
        Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    cache: 'no-cache',
})

async function railwayGraphQLRequest(query, variables) {
    try {
        return await graphqlClient.request({ document: query, variables })
    } catch (error) {
        console.log(`Action failed with error: ${error}`);
    }
}

async function getEnvironments() {
    let query =
        `query environments($projectId: String!) {
            environments(projectId: $projectId) {
                edges {
                    node {
                        id
                        name
                        deployments {
                            edges {
                                node {
                                    id
                                    status
                                }
                            }
                        }
                        serviceInstances {
                            edges {
                                node {
                                    id
                                    domains {
                                        serviceDomains {
                                            domain
                                        }
                                    }
                                    serviceId
                                    startCommand
                                }
                            }
                        }
                    }
                }
            }
        }`

    const variables = {
        "projectId": process.env.RAILWAY_PROJECT_ID,
    }

    return await railwayGraphQLRequest(query, variables)
}

async function deploymentInstanceRestart(deploymentId) {
    console.log("Restarting Deployment...")
    console.log("Deployment ID:", deploymentId)
    try {
        let query = gql`
        mutation deploymentRestart($deploymentId: String!) {
            deploymentRestart(id: $deploymentId)
        }
        `
        let variables = {
            "deploymentId": deploymentId,
        }
        return await railwayGraphQLRequest(query, variables)
    } catch (error) {
        console.log(`Action failed with error: ${error}`);
    }
}

async function getMetrics(projectId, serviceId, environmentId) {
    console.log("Getting Metrics...")
    console.log("Project ID:", projectId)
    console.log("Service ID:", serviceId)
    console.log("Environment ID:", environmentId)
    // Get current DateTime
    const date = new Date();
    try {
        let query =
            `query metrics($startDate: DateTime!, $projectId: String!, $serviceId: String! = "", $environmentId: String = "") {
            metrics(
              projectId: $projectId
              measurements: MEMORY_USAGE_GB
              startDate: $startDate
              serviceId: $serviceId
              environmentId: $environmentId
            ) {
                values {
                    ts
                    value
                    }
                measurement
            }
          }`

        let variables = {
            "projectId": projectId,
            "serviceId": serviceId,
            "startDate": date.toISOString(),
            "environmentId": environmentId,
        }

        return await railwayGraphQLRequest(query, variables)
    } catch (error) {
        console.log(`Action failed with error: ${error}`);
    }
}

async function getService(serviceId) {
    let query =
        `query environments($id: String!) {
            service(id: $id) {
                name
                deployments {
                    edges {
                      node {
                        status
                        id
                        environmentId
                      }
                    }
                }
            }
        }`

    const variables = {
        "id": serviceId,
    }

    return await railwayGraphQLRequest(query, variables)
}


async function checkRamRestart() {
    try {
        console.log('Starting RAM check...');
        // Get Environments to check if the environment already exists
        let response = await getEnvironments();

        if (!response || !response.environments) {
            console.log('No environments found');
            return;
        }

        // Filter the response to only include the environment name we are looking to create
        const targetEnvironment = response.environments.edges.filter((edge) => edge.node.name === process.env.RAILWAY_ENVIRONMENT_NAME);
        console.log('Target environment found:', targetEnvironment.length > 0);

        if (targetEnvironment.length === 0) {
            console.log('Environment not found:', process.env.RAILWAY_ENVIRONMENT_NAME);
            return;
        }

        // Get all the services in the target environment
        for (const serviceInstance of targetEnvironment) {
            for (const deployment of serviceInstance.node.serviceInstances.edges) {
                const serviceId = deployment.node.serviceId;
                const { service } = await getService(serviceId);

                if (!service) {
                    console.log('Service not found for ID:', serviceId);
                    continue;
                }

                console.log('Checking service:', service.name);

                // Check the service name to see if it matches any of the services we are looking for
                const targetServices = process.env.TARGET_SERVICE_NAME.split(',').map(name => name.trim());
                console.log('Target services:', targetServices);

                if (targetServices.includes(service.name)) {
                    console.log('Found target service:', service.name);
                    // Get the metrics for the service
                    const { metrics } = await getMetrics(process.env.RAILWAY_PROJECT_ID, serviceId, process.env.RAILWAY_ENVIRONMENT_ID);

                    if (!metrics || !metrics[0] || !metrics[0].values || metrics[0].values.length === 0) {
                        console.log('No metrics data available for service:', service.name);
                        continue;
                    }

                    // Compare the metrics to the threshold process.en.MAX_RAM_GB
                    // If the metrics are greater than the threshold, restart the service
                    const latestMetric = metrics[0].values[0].value;
                    console.log("Current Ram Usage for service", service.name, ":", latestMetric)
                    console.log("Max Ram Usage:", Number(process.env.MAX_RAM_GB))
                    if (latestMetric >= Number(process.env.MAX_RAM_GB)) {
                        const deploymentId = service.deployments.edges.filter((edge) => edge.node.environmentId === process.env.RAILWAY_ENVIRONMENT_ID)[0].node.id;
                        await deploymentInstanceRestart(deploymentId);
                        console.log("Service", service.name, "Restarted")
                    } else {
                        console.log("Service", service.name, "is within RAM limits")
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in API calls:', error);
        // Handle the error, e.g., fail the action
        console.log('API calls failed');
    }
}

async function forceRestart() {
    try {
        console.log('Starting force restart...');
        // Get Environments to check if the environment already exists
        let response = await getEnvironments();

        if (!response || !response.environments) {
            console.log('No environments found');
            return;
        }

        // Filter the response to only include the environment name we are looking to create
        const targetEnvironment = response.environments.edges.filter((edge) => edge.node.name === process.env.RAILWAY_ENVIRONMENT_NAME);
        console.log('Target environment found:', targetEnvironment.length > 0);

        if (targetEnvironment.length === 0) {
            console.log('Environment not found:', process.env.RAILWAY_ENVIRONMENT_NAME);
            return;
        }

        // Get all the services in the target environment
        for (const serviceInstance of targetEnvironment) {
            for (const deployment of serviceInstance.node.serviceInstances.edges) {
                const serviceId = deployment.node.serviceId;
                const { service } = await getService(serviceId);

                if (!service) {
                    console.log('Service not found for ID:', serviceId);
                    continue;
                }

                console.log('Checking service:', service.name);

                // Check the service name to see if it matches any of the services we are looking for
                const targetServices = process.env.TARGET_SERVICE_NAME.split(',').map(name => name.trim());
                console.log('Target services:', targetServices);

                if (targetServices.includes(service.name)) {
                    console.log('Found target service for restart:', service.name);
                    // Restart the service
                    const deploymentId = service.deployments.edges.filter((edge) => edge.node.environmentId === process.env.RAILWAY_ENVIRONMENT_ID)[0].node.id;
                    await deploymentInstanceRestart(deploymentId);
                    console.log("Service", service.name, "Restarted")
                }
            }
        }
    } catch (error) {
        console.error('Error in API calls:', error);
        // Handle the error, e.g., fail the action
        console.log('API calls failed');
    }
}

async function testConfiguration() {
    console.log('=== Configuration Test ===');
    console.log('RAILWAY_API_TOKEN:', process.env.RAILWAY_API_TOKEN ? 'Set' : 'Not set');
    console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID || 'Not set');
    console.log('RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME || 'Not set');
    console.log('RAILWAY_ENVIRONMENT_ID:', process.env.RAILWAY_ENVIRONMENT_ID || 'Not set');
    console.log('TARGET_SERVICE_NAME:', process.env.TARGET_SERVICE_NAME || 'Not set');
    console.log('MAX_RAM_GB:', process.env.MAX_RAM_GB || 'Not set');
    console.log('MAX_RAM_CRON_INTERVAL_CHECK:', process.env.MAX_RAM_CRON_INTERVAL_CHECK || 'Not set');
    console.log('CRON_INTERVAL_RESTART:', process.env.CRON_INTERVAL_RESTART || 'Not set');

    try {
        console.log('\n=== Testing Railway API Connection ===');
        const response = await getEnvironments();
        if (response && response.environments) {
            console.log('✓ Railway API connection successful');
            console.log('Available environments:', response.environments.edges.map(e => e.node.name));
        } else {
            console.log('✗ Railway API connection failed or no data returned');
        }
    } catch (error) {
        console.log('✗ Railway API connection failed:', error.message);
    }
    console.log('=== Configuration Test Complete ===\n');
}

// Run configuration test on startup
testConfiguration();

if (process.env.MAX_RAM_CRON_INTERVAL_CHECK) {
    console.log('Setting up RAM check cron with interval:', process.env.MAX_RAM_CRON_INTERVAL_CHECK);
    const ramCheckCron = Cron(process.env.MAX_RAM_CRON_INTERVAL_CHECK, async () => {
        console.log('=== Cron Job Started: Checking Ram Usage ===');
        console.log('Current time:', new Date().toISOString());
        await checkRamRestart();
        console.log('=== Cron Job Completed ===\n');
    });

    // Display next run time
    const nextRun = ramCheckCron.nextRun();
    if (nextRun) {
        console.log('Next RAM check scheduled for:', nextRun.toISOString());
        console.log('Next RAM check in:', Math.round((nextRun.getTime() - Date.now()) / 1000), 'seconds');
    }
} else {
    console.log('MAX_RAM_CRON_INTERVAL_CHECK not set - RAM monitoring disabled');
}

if (process.env.CRON_INTERVAL_RESTART) {
    console.log('Setting up force restart cron with interval:', process.env.CRON_INTERVAL_RESTART);
    const restartCron = Cron(process.env.CRON_INTERVAL_RESTART, async () => {
        console.log('=== Cron Job Started: Force Restarting Service ===');
        console.log('Current time:', new Date().toISOString());
        await forceRestart();
        console.log('=== Cron Job Completed ===\n');
    });

    // Display next run time
    const nextRun = restartCron.nextRun();
    if (nextRun) {
        console.log('Next force restart scheduled for:', nextRun.toISOString());
        console.log('Next force restart in:', Math.round((nextRun.getTime() - Date.now()) / 1000), 'seconds');
    }
} else {
    console.log('CRON_INTERVAL_RESTART not set - Force restart disabled');
}

// Display current time and timezone info
console.log('\n=== Current System Time Info ===');
console.log('Current system time:', new Date().toISOString());
console.log('Current local time:', new Date().toString());
console.log('Timezone offset:', new Date().getTimezoneOffset(), 'minutes');
console.log('=== System Ready ===\n');


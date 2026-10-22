# Railway Ram Monitor

> Forked from [dClimate's railway-ram-restart](https://github.com/dClimate/railway-ram-restart)

## Introduction to Railway

[Railway](https://railway.app/) is a PaaS Cloud Service which makes it easy to deploy simple or complex services which can depend on many other services (APIs Databases etc)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/1FHSG9?referralCode=ChuY7I)

## Inputs

| Name                        | Required | Default | Description                                                                                                                                                        |
| --------------------------- | :------: | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RAILWAY_API_TOKEN           |   [x]    |         | Railway Token. See: https://railway.app/account/tokens                                                                                                             |
| RAILWAY_PROJECT_ID          |   [x]    |         | The id of the project to create environments on. Can be found on Settings -> General page                                                                          |
| RAILWAY_ENVIRONMENT_NAME    |   [x]    |         | The name of the environment to find the deployment.                                                                                                                |
| RAILWAY_ENVIRONMENT_ID      |   [x]    |         | The id of the environment to find the deployment.                                                                                                                  |
| TARGET_SERVICE_NAME         |   [x]    |         | The name(s) of the service(s) you want to target in Railway. Multiple services can be specified by separating them with commas (e.g. "service1,service2,service3") |
| MAX_RAM_GB                  |    []    |         | The max ram threshold to trigger a restart. Required if using MAX_RAM_CRON_INTERVAL_CHECK                                                                          |
| MAX_RAM_CRON_INTERVAL_CHECK |    []    |         | The cron interval. Example "_/1 _ \* \* \*"                                                                                                                        |
| CRON_INTERVAL_RESTART       |    []    |         | The cron interval to restart regardless of the ram usage                                                                                                           |

## Cron Expression Reference

Common cron expressions for monitoring intervals:

| Interval         | Cron Expression | Description                         |
| ---------------- | --------------- | ----------------------------------- |
| Every minute     | `* * * * *`     | Check every minute                  |
| Every 5 minutes  | `*/5 * * * *`   | Check every 5 minutes               |
| Every 15 minutes | `*/15 * * * *`  | Check every 15 minutes              |
| Every 30 minutes | `*/30 * * * *`  | Check every 30 minutes              |
| **Every hour**   | `0 * * * *`     | **Check at minute 0 of every hour** |
| Every 2 hours    | `0 */2 * * *`   | Check every 2 hours                 |
| Every 6 hours    | `0 */6 * * *`   | Check every 6 hours                 |
| Daily at 2 AM    | `0 2 * * *`     | Check once per day at 2:00 AM       |
| Twice daily      | `0 6,18 * * *`  | Check at 6:00 AM and 6:00 PM        |

### Example Configuration for Hourly Check:

```env
MAX_RAM_CRON_INTERVAL_CHECK=0 * * * *
MAX_RAM_GB=2
```

## How To Use

```
   yarn install
   yarn start
```

## Viewing Logs on Railway

### Method 1: Railway Dashboard

1. Go to [railway.app](https://railway.app) and login
2. Select your project
3. Click on your service
4. Go to **Deployments** tab
5. Click on the current deployment
6. Click **"View Logs"** to see runtime logs

### Method 2: Railway CLI

Install Railway CLI and view logs in terminal:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project (run this in your project directory)
railway link

# View logs in real-time
railway logs

# View logs for specific service
railway logs --service <service-name>

# View logs with follow mode (real-time)
railway logs --follow
```

### Method 3: Log Filtering

You can filter logs by searching for specific keywords in the Railway dashboard:

- Search for `"=== Cron Job Started"` to see when cron jobs run
- Search for `"Restarted"` to see restart events
- Search for `"Current Ram Usage"` to see RAM monitoring
- Search for `"Error"` to see any errors

## Troubleshooting

If you don't see any logs:

1. Make sure your service is running
2. Check if there are any build errors in Build Logs
3. Verify your environment variables are set correctly
4. Look for the configuration test output when the service starts

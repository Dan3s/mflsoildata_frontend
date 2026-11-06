// pm2 process definition for the frontend (used by the Jenkinsfile; `pm2 startOrRestart ecosystem.config.js`).
//
// The Next.js project lives in src/ (its .env too). MFL_WEB_PORT sets the port (default 3000);
// MFL_NODE is the node binary to run it with (the Jenkinsfile exports the conda env's).
module.exports = {
  apps: [
    {
      name: "mfl_frontend",
      cwd: `${__dirname}/src`,
      script: "node_modules/next/dist/bin/next",
      interpreter: process.env.MFL_NODE || "node",
      args: `start -p ${process.env.MFL_WEB_PORT || 3000}`,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};

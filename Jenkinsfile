// Deploys the frontend to the GHG DataHub server (same server as the API).
//
// GitHub Actions already lints, type-checks, tests and builds every change and promotes
// stage -> main; this job only deploys what is on `main`. Point the Jenkins job at `main`
// (a GitHub webhook on push triggers it, or run it by hand).
//
// Credentials (Jenkins -> Manage credentials):
//   ghg-datahub       Username with password   SSH login on the server
//   ghg-datahub-host  Secret text              server IP / host name
def remote = [:]

pipeline {

    agent any

    environment {
        // Username with password: Jenkins also exposes server_USR and server_PSW.
        server = credentials('ghg-datahub')
        host   = credentials('ghg-datahub-host')

        BRANCH    = 'main'
        APP_DIR   = '/opt/ghg-datahub/front'
        CONDA_SH  = '/opt/miniforge3/etc/profile.d/conda.sh'
        CONDA_ENV = 'mplsoildata-frontend'
        PM2_APP   = 'mfl_frontend'
        WEB_PORT  = '3403'   // the port IT opened for this app
    }

    stages {
        stage('Ssh to connect GHG DataHub server') {
            steps {
                script {
                    remote.allowAnyHosts = true
                    remote.user = server_USR
                    remote.password = server_PSW
                    remote.name = 'ghg-datahub'
                    remote.host = host
                }
            }
        }

        stage('Update code') {
            steps {
                script {
                    try {
                        // reset instead of pull: the server never keeps local edits, and a
                        // build rewrites tracked files (e.g. tsconfig.tsbuildinfo) that would
                        // make the next pull stop.
                        sshCommand remote: remote, command: """
                            set -e
                            cd ${env.APP_DIR}
                            git fetch --prune origin
                            git checkout ${env.BRANCH}
                            git reset --hard origin/${env.BRANCH}
                        """
                    } catch (Exception e) {
                        echo "Git update error: ${e.message}"
                        error("Failed to update code: ${e.message}")
                    }
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    // src/.env must already exist on the server: NEXT_PUBLIC_* values are
                    // baked in at build time. Node 22 is expected (same as CI).
                    sshCommand remote: remote, command: """
                        set -e
                        . ${env.CONDA_SH}
                        conda activate ${env.CONDA_ENV}
                        cd ${env.APP_DIR}/src
                        npm ci --no-audit --no-fund
                        npm run build
                    """
                }
            }
        }

        stage('Restart frontend') {
            steps {
                script {
                    sshCommand remote: remote, command: """
                        set -e
                        . ${env.CONDA_SH}
                        conda activate ${env.CONDA_ENV}
                        cd ${env.APP_DIR}
                        # pm2 runs Next.js with the node of this conda env, not whichever node pm2 itself uses.
                        export MFL_NODE="\$(which node)"
                        export MFL_WEB_PORT=${env.WEB_PORT}
                        # Shared server: never start on, or "verify" against, a port someone else uses.
                        if ss -ltn | grep -q ":${env.WEB_PORT} " && ! pm2 describe ${env.PM2_APP} > /dev/null 2>&1; then
                            echo "Port ${env.WEB_PORT} is already used by another process" >&2
                            exit 1
                        fi
                        # A restart keeps the arguments the process was first started with, so a changed
                        # port would be ignored: drop our own process (not others') and start it afresh.
                        pm2 delete ${env.PM2_APP} > /dev/null 2>&1 || true
                        pm2 startOrRestart ecosystem.config.js --only ${env.PM2_APP} --update-env
                        pm2 save
                    """
                }
            }
        }

        stage('Check it is up') {
            steps {
                script {
                    sshCommand remote: remote, command: """
                        for i in 1 2 3 4 5 6 7 8 9 10; do
                            if curl -fsS http://127.0.0.1:${env.WEB_PORT}/ > /dev/null; then
                                echo "Frontend is answering"
                                exit 0
                            fi
                            sleep 3
                        done
                        echo "Frontend did not answer" >&2
                        pm2 logs ${env.PM2_APP} --lines 40 --nostream || true
                        exit 1
                    """
                }
            }
        }
    }

    post {
        failure {
            echo 'Frontend deploy failed: check the stage above and `pm2 logs mfl_frontend` on the server'
        }
        success {
            echo 'Frontend deployed'
        }
    }
}

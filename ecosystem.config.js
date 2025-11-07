module.exports = {
  apps: [
    {
      name: "payless-old-system",
      script: "npm",
      args: "start",
      cwd: "/var/www/payless-old-system",
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster', // Multiple instances behind a single load balancer or 'fork' = single process
      interpreter: "none",

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      max_restarts: 10, // prevents infinite restart loops if the app crashes quickly in a short time

      // Memory management
      max_memory_restart: '1G', // protecting against memory leaks
      
      // Monitoring
      watch: false, // Set to true for development
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log'
      ],
      
      // Advanced process management
      kill_timeout: 5000, // Time to wait before forcefully killing the app
      listen_timeout: 3000, // Time to wait for the app to start listening on a port
      
      // Environment variables from file
      env_file: '.env'
    }
  ]
}

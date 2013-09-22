#!/bin/bash

/usr/local/bin/redis-server &
/usr/bin/nodejs /opt/pastie/node_app/app.js

# Simulating Redis-Sentinel in Node.js
The intent with this simulation is to demonstrate swiches to a Redis-SLAVE from a Redis-MASTER by way of Redis-SENTINELS and within ```Node.js``` scriping language.

All three (Master, Slave, Sentinel) Redis instances should be setup and during tests the Redis-Master instance will be stopped (```service redis_master stop```) with the expectation that switch-overs would occure seemlessly so as not to break the application . 

Several differnt modules (```npm```) shall be tested including: 
- [redis-sentinel](https://www.npmjs.com/package/redis-sentinel "on npm site")


## Sentinel Configuration
A single Redis-Sentinel configuration file similar to the follow is used:
```
port 56381
sentinel monitor master_user 127.0.0.1 56379 1
sentinel down-after-milliseconds master_user 9
```
A 9 millisecond delay has been used to expedite detections of downtimes. 

###### _```NOTE```_: For proudciton at least __three__ (__3__)  or more seperate redis-sentinels on seperate hosts / devices are required. 

### Todo's
 - Find working & effortless module. 


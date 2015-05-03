# Simulating Redis-Sentinel in Node.js
![Alt text](redis-sim.gif "Blessed TUI version of Demo")

This simulation, authored in ```Node.js``` scripting language, is intended to demonstrate in real-tine switching and switch-over to a Redis-SLAVE from a Redis-MASTER by way of Redis-SENTINELS.

All three (Master, Slave, Sentinel) Redis instances should be setup and during tests the Redis-Master instance will be stopped (```service redis_master stop```) with the expectation that switch-overs would occure seemlessly.

The ```q_``` prefix examples are more complete utalising __offline-queuing__ where all ```.set``` requests are stacked onto an array for later flushing to redis. ```q_blessed``` uses the *T*erminal-*U*ser-*I*nterface module to mimic ncurses like layout and screening.


## Sentinel Configuration
A single Redis-Sentinel configuration file similar to the follow is used:
```
port 46381
sentinel monitor master_user 127.0.0.1 46379 1
sentinel down-after-milliseconds master_user 9
sentinel failover-timeout master_user 1000
sentinel announce-ip "192.168.178.12"
```
A 9 millisecond delay has been used to expedite detections using shorter downtimes.


###### _```NOTE```_: For proudciton at least __three__ (__3__)  or more seperate redis-sentinels on seperate hosts / devices are required.
###### ALSO: its worth baring in mind that .GET & .SET occurance are on a single socket / connection. For production development or in High Frequency IO it may be more beneficial to seperate these onto indepedent  chennels.




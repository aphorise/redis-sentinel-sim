/* a = array, b = boolean, c = byte/character, f = float, i = integer, o = object, s = string */
var f_SysT1=Date.now()/1000; //start time for measuring init times
var bTTY = Boolean(process.stdout.isTTY); // execution in terminal?
function sRaw(msg) { return bTTY ? msg : msg.replace( /\033\[[0-9;]*m/g, "" ); } /* strip TTY ANSI colours if not in shell. */
var sCR = sRaw("\033[31m"), /* Red */ sCC = sRaw("\033[36m"), /* Cyan */
	sCDG = sRaw("\033[90m"),/* Dark Gray */ sCG = sRaw("\033[32m"), /* Green */
	sCN = sRaw("\033[0m"),  /* Natural (no color) */ sCNB = sRaw("\033[1m"),/* Natural Bold */
	sCP = sRaw("\033[35m"), /* Purple / Magenta */ sCY = sRaw("\033[33m"),  /* Yellow */
	sCRBG = sRaw("\033[41");/* Red Background White Text */
//----------------------------------------------------------------
/* Packages Required: */
//----------------------------------------------------------------
var redis, sentinel;
try
{
	redis = require("redis");
	sentinel = require("redis-sentinel");
	redis.debug_mode = false;
}
catch (e)
{
	console.log(sCR+e+sCN);
	console.log(sCRBG + "npm install" + sCN + "?" + sCY + " modules" + sCN + " missing locally / globally?\n" + sCNB + "Attempting NPM install" + sCN);
	var exec = require("child_process").exec, child;
	child = exec("npm install", function (error, stdout, stderr)
	{
		console.log( (error !== null) ?
			sCR + "ERROR running npm or rights issue." + sCN + error :
				stdout+sCNB + "NPM installed." + sCN );
	});
	console.log("DONE - NPM - Manually restart process."); return process.exit(0);
	// try{ redis = require("redis"); sentinel = require("redis-sentinel"); redis.debug_mode = false; }
	// catch (e) { console.log(sCNB+e+sCR +"\nISSUES" +  sCN + "with specific modules or their install."); return process.exit(1); }
} //--------------------------------------------------------------
//----------------------------------------------------------------

var sRedisName = "master_user";
var aSentinles = [ {host: "127.0.0.1", port: 46381} ]; // Redis sentinel endpoints
var client;
var sLastWrite;
var iLastCounter = 0;
var iQueueCounter = 0;
var aQueueStack = new Array(); /* array holding offline items */
var bReconnect = undefined;
var bRedisReady = false;

var sL = sCNB + "\n@========================================@" + sCN; /* Line for TUI */
var sWelcome = sCG + "STARTED " + sCN + sCNB + "redis-sentinel-sim " + sCN + "@ ";
var sInitMsg = sCP + "System ININT " + sCN + sCNB + "in: " + sCG + "%s" + sCN + " seconds";
var sErrorCon = sCR + "ERROR" + sCN + ": Connecting to " + sCNB + "REDIS" + sCN + "via sentinel."+sL;
var sSuccessCon = sCC + "Success! Connected" + sCN + " to " + sCNB + "Redis" + sCN + " on " + sCNB;
var sWriteError = sCR + "ERROR" + sCN + ": " + sCNB + "SET" + sCN + " to redis" + sCNB + "! " + sCY + " QUEUING " + sCN + "for later write.";
var sQueueError = sCR + "ERROR" + sCN + ": writing / pushing queue to redis";
var sResponseErr = sCR + "ERROR" + sCN + ": " + sCNB + "GET" + sCN + "from redis.";
var sResponseGot = sCC + "GOT" + sCN + ":<- ";
var sResponseSet = sCP + "SET" + sCN + ":-> ";
var sSetIssue = sCDG + "ISSUE" + sCN + ": with " + sCNB + "WRITE" + sCN;
var sGetIssue = sCDG + "ISSUE" + sCN + ": with " + sCNB + "READ" + sCN;
var sQueue = sCY + "FLUSHING " + sCN + sCNB + "QUEUE" + sCN + " of: " + sCR + sCNB + "%s" + sCN + " items to Redis.";
var sQueueFlushed = sCG + "Successfully " + sCN + sCNB + "flushed QUEUE " + sCN + "of: " + sCNB + "%s" + sCN + " ITEMS.";

function offline_flush()
{
	if (0 < iQueueCounter) console.log(sQueue, iQueueCounter);
	for (var ix = 0; ix < iQueueCounter; ++ix)
	{
		var sToWrite = aQueueStack[ix];
		try
		{
			client.set(iLastCounter, sToWrite, function(err, reply){});
			client.set("iLastCounter", iLastCounter, function(err, reply){});
			++iLastCounter;
		}
		catch(e){ console.log(sQueueError + e); break; }
	}
	iQueueCounter = iQueueCounter-ix;
	console.log(sQueueFlushed, ix); 
}

function init_redis()
{
	try { client = sentinel.createClient(aSentinles, sRedisName, {/* standard ops - nothing special */} ); }
	catch (e){ console.log("ERROR: Redis-Sentinel exception! "+e); }

	client.on("error", function() { console.log(sErrorCon); });

	client.on("connect", function()
	{
		console.log(sSuccessCon + client.connectionOption.host + sCN + ":" + sCNB + client.connectionOption.port + sCN + sL);
		client.get("iLastCounter", function (err, reply)
		{
			bReconnect = bReconnect === undefined ? false : true;
			//console.log( err ? sResponseErr+err : (reply === null) ? "NEW DB" : "SLAVE DB with index of: "+ reply.toString() ) ;
			iLastCounter =  err ? iLastCounter : (reply === null) ? 0 : (iLastCounter < reply.toString()) ? reply.toString() : iLastCounter;
			while (0 < iQueueCounter) { offline_flush(); }
			bRedisReady = (iQueueCounter === 0) ? true : false; 
		});
	});
}

fCBWrite = function (err, reply)
{
	if (err === null || err === "undefined") { console.log(sResponseSet+sLastWrite); ++iLastCounter; }
	else
	{
		bRedisReady = false;
		console.log(sWriteError);
		aQueueStack[aQueueStack.length] = sLastWrite;
		++iQueueCounter;
	}
};

function redis_loop_write()
{
	sLastWrite = new Date().getTime()/1000;
	if (bRedisReady)
	{
		try
		{
			client.set(iLastCounter, sLastWrite, fCBWrite);
			client.set("iLastCounter", iLastCounter, function(err, reply){} );
			// console.log("REDIS - done write-index: %s", iLastCounter);
			// if (bReconnect) { console.log("\n\nEXIT\n\n"); process.exit(0); } /* exit after reconnect & flush */			
		}
		catch(e) { console.log(sSetIssue); }

		try
		{
			client.get(iLastCounter, function (err, reply)
			{
				console.log( err ? sResponseErr+err : (reply === null) ? "Error: LastWrite is null" : sResponseGot+reply.toString() );
			});
		}
		catch(e) { console.log(sGetIssue);}
	}
	else
	{
		console.log(sWriteError);
		aQueueStack.push(sLastWrite);
		++iQueueCounter;
	}
}

setInterval(function(){ redis_loop_write(); }, 1000).unref();
console.log(sWelcome+new Date());
var f_SysT2=Date.now()/1000-f_SysT1;  // measuring init times here
console.log(sInitMsg, f_SysT2, sL);
init_redis();

_sysT1=Date.now()/1000; //start time for measuring init times

/* Packages Required: */
//----------------
var blessed, redis, sentinel;
try
{
	redis = require("redis");
//	sentinel = require("redis-sentinel");
}
catch (e)
{
	console.log("\033[31m"+e+"\033[0m");
	console.log("\033[41mnpm install\033[0m ? \033[33m modules\033[0m missing locally / globally.");
	return process.exit(1);
}
//----------------

// Redis sentinel endpoints 
var masterName = "master_user";
var cleint;

/* DEBUG function to insepct object and content */ 
function var_dump(obj)
{
	var out = "";
	for (var ix in obj) { if (typeof obj[ix] === "object") var_dump(obj[ix]); else out += ix + ": " + obj[ix] + "\n"; }
	console.log(out+"\nITEM with: "+ix+" <-- inner elements");
}

var sL = "\n\033[1m@========================================@\033[0m"; /* String General Line for TUI */

setInterval(function(){ redis_loop_write(); }, 1000).unref();

function init_redis()
{
	try {
	client = redis.createClient(56379, masterName, {no_ready_check: true} ); 
	} catch (e){ console.log("\n\n\n------------\n"+e); }
	client.on("error", function() { console.log("\033[31mERROR:\033[0m Connecting to \033[1mREDIS\033[0m via sentinel."+sL); });
	client.on("connect", function() { console.log("\033[36mSuccess! Connected\033[0m to\033[1m Redis\033[0m on \033[1m"+ client.connectionOption.host +"\033[0m:\033[1m"+ client.connectionOption.port +"\033[0m"+sL); });
	redis.debug_mode = false;
}

exports.print = function (err, reply) 
{
//	if (err === null || err === "undefined") console.log("\033[35mSET\033[0m:-> "+lastDate);
//	else console.log("\033[33m ERROR \033[35mcan NOT set.\033[0m!!! ");
};

var lastDate;
function redis_loop_write()
{
	lastDate = new Date().toTimeString(); 
	try{ client.set("foo", lastDate, exports.print); }
	catch(e) { console.log("ISSUE - w/ SETTING");}

	try
	{ 
		client.get("foo", function (err, reply)
		{
			if (err) { console.log("ERROR w/ GET "+err) ; /* return process.exit(1); */ }
			console.log("\033[36mGOT\033[0m:<- "+reply.toString());
		});
	}
	catch(e) { console.log("ISSUE - GETTING");}
}
console.log("\n\033[32m\033[1mSTARTED\033[0m \033[1mredis-sentinel-sim \033[0m@ "+new Date());
_sysT2=Date.now()/1000-_sysT1;  // measuring init times here
console.log("\033[35mSystem ININT\033[0m\033[1m in:\033[32m %s\033[0m seconds", _sysT2, sL);
init_redis();

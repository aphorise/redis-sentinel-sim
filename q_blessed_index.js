/* a = array, b = boolean, c = byte/character, f = float, i = integer, o = object, s = string */
var f_SysT1=f_SysT2=Date.now()/1000; //start time for measuring init times
var bTTY = Boolean(process.stdout.isTTY); // execution in terminal?
function is_int(value){ return (parseFloat(value) == parseInt(value)) && !isNaN(value); }
function sRaw(msg) { return bTTY ? msg : msg.replace( /\033\[[0-9;]*m/g, "" ); } /* strip TTY ANSI colours if not in shell. */
var sCR = sRaw("\033[31m"), /* Red */ sCC = sRaw("\033[36m"), /* Cyan */
	sCDG = sRaw("\033[90m"),/* Dark Gray */ sCG = sRaw("\033[32m"), /* Green */
	sCN = sRaw("\033[0m"),  /* Natural (no color) */ sCNB = sRaw("\033[1m"),/* Natural Bold */
	sCP = sRaw("\033[35m"), /* Purple / Magenta */ sCY = sRaw("\033[33m"),  /* Yellow */
	sCRBG = sRaw("\033[41");/* Red Background White Text */
//----------------------------------------------------------------
/* Packages Required: */
//----------------------------------------------------------------
var blessed, redis, sentinel;
try
{
	blessed = require("blessed");
	redis = require("redis");
	sentinel = require('redis-sentinel');
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
} //--------------------------------------------------------------
//----------------------------------------------------------------

// Redis sentinel endpoints 
var aSentinles = [ {host: '127.0.0.1', port: 46381} ];
var sRedisName = 'master_user';
var client;
var iTimeInterval = 1000; // milisecond interval between SET/GET
var aTimer;		// timer object for later disabling.

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

/* Blessed NPM specifics: */ 
var program = blessed.program();
program.disableMouse();
program.on("mouse", function(data){ if (data.action === "mousemove")  program.disableMouse(); });
var screen = blessed.screen({ /* dump: __dirname + "/logs/listbar.log", */ autoPadding: false});
var box = blessed.box({ parent: screen, top: 0, right: 0, width: "shrink", height: "shrink", content: "..."});

/* LEFT hand area */ 
var logger1 = blessed.log
({
	parent: screen,
	top: "center", left: "1%",
	width: "49%", height: "85%",
	border: "line",
	tags: true,
	keys: true, mouse: false, //vi: true,
	scrollback: 100,
	scrollbar: { ch: " ", track: { bg: "#ef00ef" }, style: { inverse: true } }
});
/* RIGHT hand area */ 
var logger2 = blessed.log
({
	parent: screen,
	top: "center", left: "51%",
	width: "49%", height: "85%",
	border: "line",
	tags: true,
	keys: true, mouse: false, //vi: true,
	scrollback: 100,
	scrollbar: { ch: " ", track: { bg: "cyan" }, style: { inverse: true } }
});

var bar = blessed.listbar
({
	parent: screen,
	bottom: 1,//left: 1, right: 3, width: 50,
	height: 3, //true ? "shrink" : 3,
	mouse: false, keys: true,
	autoCommandKeys: true,
	border: "line", //vi: true,
	style:
	{
		bg: "green",
		item: { bg: "red", hover: {bg: "blue"}, /* focus: {bg: "blue"} */ },
		selected: { bg: "blue" }
	},
	commands:
	{
		"RESTART": function() { box.setContent("RESTART Pressed."); restart_all(); },
		"LEFT": function() { box.setContent("LEFT Area selected."); screen.render(); logger1.focus(); },
		"RIGHT": function() { box.setContent("RIGHT Area selected."); screen.render(); logger2.focus(); },
		"INTERVAL": function() { box.setContent("CHANGE Intervals."); screen.append(input); input.focus(); },
		"QUIT": 
		{ 
			keys: ["q"], 
			callback: function() 
			{ 
				program.clear();
				program.disableMouse();
				program.showCursor(); program.normalBuffer();
				program.write(sRaw("Execution " + sCC + "Time" + sCN + " in Seconds: " + sCNB + (Date.now()/1000-f_SysT1).toString()+sL+"\n"));
				return process.exit(0);
			} 
		}
	}
});

var input = blessed.textbox(
{
	label: ' Interval in Milisecs',
	content: '', border: 'line',
	style: { fg: 'cyan', bg: 'default', bar: { bg: 'default', fg: 'yellow'},
	border: { fg: 'yellow', bg: 'blue' } },
	width: '25%', height: 3, left: "center", top: "center",
	keys: true, vi: true, mouse: false, inputOnFocus: true
});

input.on('submit', function(value)
{
	if (value)
	{
		input.clearInput(); screen.remove(input); screen.render();
		if (!is_int(value))
			screen.children[0].setContent(value+" << is "+ sCR + "NOT" + sCN + " an " + sCNB + "intereger." + sCN + "Retry.");
		else
		{
			iTimeInterval = value; 
			clearInterval(aTimer);
			logger1.log("Got new interval of: %s miliseconds", value); 
			aTimer = setInterval(function(){ redis_loop_write(); screen.render(); }, iTimeInterval);	
			logger2.log("Time restarted @: %s milisecs apart", value); 
		}
	}
	else input.focus();	// lock for input 
});

function offline_flush()
{
	if (0 < iQueueCounter) logger1.log(sQueue, iQueueCounter);
	for (var ix = 0; ix < iQueueCounter; ++ix)
	{
		var sToWrite = aQueueStack[ix];
		try
		{
			client.set(iLastCounter, sToWrite, function(err, reply){});
			client.set("iLastCounter", iLastCounter, function(err, reply){});
			++iLastCounter;
		}
		catch(e){ logger1.log(sQueueError + e); break; }
	}
	iQueueCounter = iQueueCounter-ix;
	logger2.log(sQueueFlushed, ix); 
}

function init_redis()
{	
	try { client = sentinel.createClient(aSentinles, sRedisName, {/* standard ops - nothing special */} ); }
	catch (e){ console.log("ERROR: Redis-Sentinel exception! "+e); }
	
	client.on("error", function() { logger2.log(sErrorCon); });	
	client.on("connect", function()
	{
		logger2.log(sSuccessCon + client.connectionOption.host + sCN + ":" + sCNB + client.connectionOption.port + sCN + sL);
		client.get("iLastCounter", function (err, reply)
		{
			bReconnect = bReconnect === undefined ? false : true;
//			console.log( err ? sResponseErr+err : (reply === null) ? "iLastCounter == NEW" : "old Counter == "+ reply.toString() ) ;
			iLastCounter =  err ? iLastCounter : (reply === null) ? 0 : (iLastCounter < reply.toString()) ? reply.toString() : iLastCounter;
			while (0 < iQueueCounter) { offline_flush(); }
			bRedisReady = (iQueueCounter === 0) ? true : false; 
		});
	});
}

fCBWrite = function (err, reply)
{
	if (err === null || err === "undefined") { logger1.log(sResponseSet+sLastWrite); ++iLastCounter; }
	else
	{
		bRedisReady = false;
		logger1.log(sWriteError);
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
			// logger1.log("DONE - write-index: %s", iLastCounter);
			// if (bReconnect) { console.log("\n\nEXITING on Reconnect\n\n"); process.exit(0); } /* exit after reconnect + flush */			
		}
		catch(e) { console.log(sSetIssue); }

		try
		{
			client.get(iLastCounter, function (err, reply)
			{
				logger2.log( err ? sResponseErr+err : (reply === null) ? "Error: LastWrite is null" : sResponseGot+reply.toString() );
			});
		}
		catch(e) { logger2.log(sGetIssue);}
	}
	else
	{
		logger1.log(sWriteError);
		logger2.log("Skip Read (Offline)");
		aQueueStack.push(sLastWrite);
		++iQueueCounter;
	}
}

function restart_all()
{
	var f_SysT3=Date.now()/1000;  // measuring init times here
	clearInterval(aTimer);
	logger1.content = ""; logger2.content = ""; screen.render();	// CLEAR
	aTimer = setInterval(function(){ redis_loop_write(); screen.render(); }, iTimeInterval);	
	f_SysT3=Date.now()/1000-f_SysT3;
	logger1.log(sInitMsg, f_SysT3, sL);
	init_redis();
}

console.log(sWelcome+new Date());
screen.render();
aTimer = setInterval(function(){ redis_loop_write(); screen.render(); }, iTimeInterval);
f_SysT2=Date.now()/1000-f_SysT1;  // measuring init times here
logger1.log(sInitMsg, f_SysT2, sL);
init_redis();

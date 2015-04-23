_sysT1=Date.now()/1000; //start time for measuring init times

/* Packages Required: */
//----------------
var blessed, redis, sentinel;
try
{
	blessed = require("blessed");
	redis = require("redis");
	sentinel = require('redis-sentinel');
}
catch (e)
{
	console.log("\033[31m"+e+"\033[0m");
	console.log("\033[41mnpm install\033[0m ? \033[33m modules\033[0m missing locally / globally.");
	return process.exit(1);
}
//----------------

// Redis sentinel endpoints 
var endpoints = [ {host: '127.0.0.1', port: 56381} ];
var masterName = 'master_user';
var cleint;

/* DEBUG function to insepct object and content */ 
function var_dump(obj)
{
	var out = '';
	for (var ix in obj) { if (typeof obj[ix] === 'object') var_dump(obj[ix]); else out += ix + ": " + obj[ix] + "\n"; }
	console.log(out+"\nITEM with: "+ix+" <-- inner elements");
}

var program = blessed.program();
program.disableMouse();
program.on("mouse", function(data){ if (data.action === "mousemove")  program.disableMouse(); });
var screen = blessed.screen({ /* dump: __dirname + "/logs/listbar.log", */ autoPadding: false});
var box = blessed.box({ parent: screen, top: 0, right: 0, width: "shrink", height: "shrink", content: "..."});

var sL = "\n\033[1m@========================================@\033[0m"; /* String General Line for TUI */

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
		"restart": function() { box.setContent("Pressed one."); screen.render(); },
		".": function() { box.setContent("Pressed two."); screen.render(); },
		" ": function() { box.setContent("Pressed three."); screen.render(); },
		"quiet": 
		{ 
			keys: ["q"], 
			callback: function() 
			{ 
				program.disableMouse();
				program.showCursor(); program.normalBuffer();
				program.clear();
				program.write('Execution \033[36mTime\033[0m in Seconds: \033[1m'+(Date.now()/1000-_sysT1).toString()+"\n"+sL+"\n");
				return process.exit(0);
			} 
		}
	}
});

setInterval(function()
{
	logger1.focus();
//	logger1.log("ABVC\33[42m world\033[0m Hello %s", Date.now().toString("h:mm:ss a"));
//	if (Math.random() < 0.30){ logger1.log({foo:{bar:{baz:true}}}); }
	redis_loop_write();
	screen.render();
}, 1000).unref();

function init_redis()
{
	try {
	client = sentinel.createClient(endpoints, masterName, {/* standard ops - nothing special */} ); 
	} catch (e){ console.log("\n\n\n------------\n"+e); }
	client.on("error", function() { logger2.log("\033[31mERROR:\033[0m Connecting to \033[1mREDIS\033[0m via sentinel."+sL); });
	client.on("connect", function() { logger2.log("\033[36mSuccess! Connected\033[0m to\033[1m Redis\033[0m on \033[1m"+ client.connectionOption.host +"\033[0m:\033[1m"+ client.connectionOption.port +"\033[0m"+sL); });
	redis.debug_mode = false;
}


exports.print = function (err, reply) 
{
	if (err === null || err === 'undefined') logger1.log("\033[35mSET\033[0m:-> "+lastDate);
	else logger1.log("\033[33m ERROR \033[35mcan NOT set.\033[0m!!! ");
};


var lastDate;
function redis_loop_write()
{
	lastDate = new Date().toTimeString(); 
	try{ client.set("foo", lastDate, exports.print); }
	catch(e) { logger1.log("ISSUE - w/ SETTING");}

	try
	{ 
		client.get("foo", function (err, reply)
		{
			if (err) { logger2.log("ERROR w/ GET "+err) ; /* return process.exit(1); */ }
			logger2.log("\033[36mGOT\033[0m:<- "+reply.toString());
		});
	}
	catch(e) { logger2.log("ISSUE - GETTING");}
}
console.log("\n\033[32m\033[1mSTARTED\033[0m \033[1mredis-sentinel-sim \033[0m@ "+new Date());
screen.render();
_sysT2=Date.now()/1000-_sysT1;  // measuring init times here
logger1.log("\033[35mSystem ININT\033[0m\033[1m in:\033[32m %s\033[0m seconds", _sysT2, sL);
init_redis();

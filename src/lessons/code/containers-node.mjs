import { execSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import os from "node:os";

// isolate では使えない child_process と、実ファイルシステムが使える / child_process and a real file system work here
console.log("node", process.version, os.platform(), os.arch());
writeFileSync("/tmp/hello.txt", "hello from container");
console.log("/tmp has hello.txt:", readdirSync("/tmp").includes("hello.txt"));
console.log("uname:", execSync("uname -sr").toString().trim());

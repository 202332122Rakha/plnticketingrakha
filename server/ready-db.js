import {connect,pool} from './db.js';
import {assessReadiness,readMigrationManifest} from './readiness.js';
import {databaseErrorMessage} from './config.js';
let client;
try{
 client=await connect();
 const result=await assessReadiness(client,await readMigrationManifest(),{writeProbe:!process.argv.includes('--read-only'),requireAdmin:!process.argv.includes('--allow-no-admin')});
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.code?`${databaseErrorMessage(error)} (${error.code})`:error.message);process.exitCode=1;}
finally{if(client)client.release();await pool.end();}

// Optional native PostgreSQL runner. Socket only; deliberately no URL/password or
// remote-host support. Creates/drops a uniquely named EMPTY test database.
import {randomBytes} from 'node:crypto';
const pg=await import(process.env.PG_TEST_MODULE||'pg');
const Client=pg.Client||pg.default.Client;
const socket=process.env.LOCAL_PG_SOCKET;
if(process.env.BUSCAG_TEST_CLUSTER!=='disposable'||!socket?.startsWith('/')||socket.includes('\0')) throw new Error('LOCAL_PG_SOCKET and BUSCAG_TEST_CLUSTER=disposable are required');
export class PGlite {
  constructor(){
    this.name='buscag_test_'+randomBytes(8).toString('hex');
    this.admin=new Client({host:socket,user:'postgres',database:'postgres',port:5432,ssl:false,password:'',connectionTimeoutMillis:5000});
    this.ready=this.initialize();
  }
  async initialize(){
    await this.admin.connect();await this.admin.query(`create database ${this.name}`);
    this.client=await this.fork();
  }
  async fork(){
    const client=new Client({host:socket,user:'postgres',database:this.name,port:5432,ssl:false,password:'',connectionTimeoutMillis:5000});
    await client.connect();return client;
  }
  async exec(sql){await this.ready;return this.client.query(sql);}
  async query(sql,args){await this.ready;return this.client.query(sql,args);}
  async close(){
    try {await this.ready;await this.client.end();}
    finally {await this.admin.query(`drop database if exists ${this.name} with (force)`);await this.admin.end();}
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAutoAssignment} from '../admin-routes.js';
test('automatic assignment writes the same public ticket state as manual assignment',async()=>{
  const writes=[];
  const client={async query(text,values=[]){
    if(text.startsWith('SELECT * FROM assignment_rules'))return {rows:[{id:'rule-one',target_team:'Network',load_balancing_strategy:'direct_pic',default_pic_id:'pic-one'}]};
    if(text.startsWith('SELECT u.id FROM users'))return {rows:[{id:'pic-one'}]};
    writes.push({text,values});return {rows:[],rowCount:1};
  }};
  await applyAutoAssignment(client,'ticket-one','category-one','unit-one','reporter-one');
  const ticketUpdate=writes.find(write=>write.text.startsWith('UPDATE tickets SET'));
  assert.ok(ticketUpdate);
  assert.deepEqual(ticketUpdate.values,['pic-one','auto','ticket-one']);
  assert.match(ticketUpdate.text,/assignment_status='assigned'/,'Ticket API state must be assigned, not the separate PIC acceptance state pending');
  assert.ok(writes.some(write=>write.text.startsWith('INSERT INTO audit_logs')));
});

/*
 * Test that replSetReconfig can add and remove arbiters.
 */

// hello fails on the arbiter once it's removed, which blocks all checks.
TestData.skipCheckDBHashes = true;

(function() {
'use strict';

load('jstests/replsets/rslib.js');

const replTest = new ReplSetTest({nodes: 2});
replTest.startSet();
replTest.initiate();

jsTestLog('Start arbiter');
const arbiterConn = replTest.add();
const admin = replTest.getPrimary().getDB('admin');
const conf = replTest.getReplSetConfigFromNode();
conf.members.push({_id: 2, host: arbiterConn.host, arbiterOnly: true});
conf.version++;

jsTestLog('Add arbiter');
assert.commandWorked(admin.runCommand({replSetReconfig: conf}));

replTest.waitForState(arbiterConn, ReplSetTest.State.ARBITER);
jsTestLog(`Wait for ${arbiterConn} to enter state ARBITER in primary's replSetGetStatus`);
assert.soon(() => {
    let status = assert.commandWorked(admin.runCommand({replSetGetStatus: 1}));
    return ReplSetTest.State.ARBITER === status.members[2].state;
});

conf.members.pop();
conf.version++;

jsTestLog('Remove arbiter');
assert.commandWorked(admin.runCommand({replSetReconfig: conf}));

assert.soonNoExcept(
    () => {
        // The arbiter dropped connections when it was removed.
        reconnect(arbiterConn);
        let status = arbiterConn.getDB('admin').runCommand({replSetGetStatus: 1});
        print(`replSetGetStatus: ${tojson(status)}`);
        return status.code === ErrorCodes.InvalidReplicaSetConfig;
    },
    "waiting for arbiter's replSetGetStatus to show that the arbiter was removed",
    undefined /* timeout */,
    1000 /* intervalMS */);

replTest.stopSet();
})();

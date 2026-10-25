// No dependencies, microphone, credentials or network. Run from any directory.
import {initialTask, transition, taskToken, buildCommand, CLI_TEMPLATES, EVIDENCE} from '../../../docs/app/js/agent-lab.js';
const scenario=process.argv[2]||'voice';
if(!['voice','visual','cli','media'].includes(scenario)) {
  console.error('Usage: node run.mjs voice|visual|cli|media');process.exitCode=2;
} else {
  const output={mode:'mock',providerCalls:0,scenario};
  if(scenario==='cli')output.commands=Object.fromEntries(Object.entries(CLI_TEMPLATES).map(([kind,t])=>[kind,buildCommand(kind,t.value)]));
  else if(scenario==='media')output.evidence=EVIDENCE;
  else {
    let s=initialTask({visual:scenario==='visual'});
    for(const type of ['start','stop-speech','permission',scenario==='visual'?'context':'update','permission','approve','talk','result','deliver','talk','deliver']) {
      s=transition(s,{type,token:type==='approve'?s.approval?.token:taskToken(s)});
    }
    output.state=s;
  }
  console.log(JSON.stringify(output,null,2));
}

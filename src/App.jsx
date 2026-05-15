import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES = [
  { name: "AI Safety",          color: "#8B6508" },
  { name: "AI Policy",          color: "#1A7A5E" },
  { name: "Digital Justice",    color: "#C04E00" },
  { name: "Governance",         color: "#1A5EA8" },
  { name: "Bias and Fairness",  color: "#A0306A" },
  { name: "Critical Computing", color: "#6340A8" },
  { name: "Environment",        color: "#2A7A60" },
  { name: "Ethics",             color: "#A04040" },
];
const COLOR = Object.fromEntries(THEMES.map(t => [t.name, t.color]));

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" }); }
function prevDay(d) { const dt = new Date(d+"T12:00:00"); dt.setDate(dt.getDate()-1); return dt.toISOString().slice(0,10); }
function nextDay(d) { const dt = new Date(d+"T12:00:00"); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); }
function dateSeed(s) { return parseInt(s.replace(/-/g,""),10); }
function seededShuffle(arr, seed) {
  const a = [...arr]; let s = seed;
  for (let i = a.length-1; i > 0; i--) { s = (Math.imul(s,1664525)+1013904223)|0; const j = Math.abs(s)%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function getDispatch(dateStr, pool) {
  const seed = dateSeed(dateStr);
  const na = pool.filter(x => x.type === "essay");
  const found = pool.filter(x => x.type === "foundational");
  const recent = pool.filter(x => x.type === "recent");
  return {
    nonAcademic: seededShuffle(na, seed).slice(0,4),
    academic: [...seededShuffle(recent, seed+1).slice(0,2), ...seededShuffle(found, seed+2).slice(0,2)]
  };
}

// ─── Built-in pool ────────────────────────────────────────────────────────────

const BUILTIN = [
  { id:"na1",  title:"The Mounting Human and Environmental Costs of the AI Boom", url:"https://themarkup.org/hello-world/2023/06/08/the-mounting-human-and-environmental-costs-of-the-ai-boom", source:"The Markup", published:"Jun 2023", keywords:["energy consumption","data centres","labour"], readingMinutes:9, theme:"Environment", type:"essay" },
  { id:"na2",  title:"The Carbon Footprint of ChatGPT", url:"https://www.technologyreview.com/2022/11/14/1063192/the-carbon-footprint-of-chatgpt/", source:"MIT Technology Review", published:"Nov 2022", keywords:["carbon emissions","llm training","sustainability"], readingMinutes:7, theme:"Environment", type:"essay" },
  { id:"na3",  title:"AI Water Use Is a Crisis No One Is Talking About", url:"https://themarkup.org/hello-world/2023/08/03/ai-water-use-is-a-crisis-no-one-is-talking-about", source:"The Markup", published:"Aug 2023", keywords:["water consumption","data centres","environmental impact"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na4",  title:"The Hidden Environmental Cost of the Metaverse", url:"https://www.wired.com/story/hidden-environmental-cost-metaverse/", source:"Wired", published:"Nov 2022", keywords:["metaverse","energy use","environmental cost"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na5",  title:"How Much Energy Does AI Actually Use?", url:"https://www.technologyreview.com/2023/12/01/1084189/making-an-image-with-generative-ai-uses-as-much-energy-as-charging-your-phone/", source:"MIT Technology Review", published:"Dec 2023", keywords:["energy benchmarks","generative ai","carbon"], readingMinutes:7, theme:"Environment", type:"essay" },
  { id:"na6",  title:"Data Centres Are Taking Over Small Towns", url:"https://restofworld.org/2023/data-centers-rural-communities/", source:"Rest of World", published:"Sep 2023", keywords:["data centres","local communities","land use"], readingMinutes:10, theme:"Environment", type:"essay" },
  { id:"na7",  title:"Can AI and Sustainability Coexist?", url:"https://www.theguardian.com/technology/2023/jun/08/can-ai-and-sustainability-coexist", source:"The Guardian", published:"Jun 2023", keywords:["sustainability","ai emissions","green tech"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na8",  title:"Timnit Gebru on the Danger of AI Doomerism", url:"https://www.wired.com/story/timnit-gebru-ai-doomerism/", source:"Wired", published:"Mar 2023", keywords:["dair institute","ai harms","research culture"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na9",  title:"A.I. Is Not Sentient. Why Do People Say It Is?", url:"https://www.nytimes.com/2022/08/05/technology/ai-sentient-google-lemoine.html", source:"New York Times", published:"Aug 2022", keywords:["ai consciousness","anthropomorphism","media framing"], readingMinutes:7, theme:"Ethics", type:"essay" },
  { id:"na10", title:"The Eyeball Economy of Algorithmic Extremism", url:"https://www.nytimes.com/2021/04/25/opinion/facebook-ai-extremism.html", source:"New York Times", published:"Apr 2021", keywords:["recommendation systems","radicalisation","engagement"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na11", title:"Chatbots Won't Save Mental Health Care", url:"https://www.theatlantic.com/technology/archive/2023/10/mental-health-ai-chatbots/675579/", source:"The Atlantic", published:"Oct 2023", keywords:["mental health ai","therapeutic chatbots","care ethics"], readingMinutes:11, theme:"Ethics", type:"essay" },
  { id:"na12", title:"The Case for Slowing Down AI", url:"https://www.newyorker.com/science/annals-of-artificial-intelligence/the-case-for-slowing-down-ai", source:"The New Yorker", published:"Nov 2023", keywords:["ai pause","existential risk","responsible development"], readingMinutes:14, theme:"Ethics", type:"essay" },
  { id:"na13", title:"How Tech Giants Are Framing AI Risks to Dodge Real Accountability", url:"https://www.vice.com/en/article/how-big-tech-uses-ai-doom-to-distract-from-harm/", source:"Vice", published:"Jun 2023", keywords:["ai ethics washing","corporate framing","accountability"], readingMinutes:9, theme:"Ethics", type:"essay" },
  { id:"na14", title:"We Need to Talk About How Good AI Is Getting at Lying", url:"https://www.technologyreview.com/2023/02/01/1067610/ai-is-getting-better-at-lying/", source:"MIT Technology Review", published:"Feb 2023", keywords:["deception","ai honesty","language models"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na15", title:"AI Safety Is Not a Silver Bullet", url:"https://logicmag.io/home/ai-safety-is-not-a-silver-bullet/", source:"Logic Magazine", published:"Feb 2023", keywords:["ai safety critique","power","governance"], readingMinutes:14, theme:"AI Safety", type:"essay" },
  { id:"na16", title:"The Politics of AI Alignment", url:"https://www.phenomenalworld.org/analysis/the-politics-of-ai-alignment/", source:"Phenomenal World", published:"Nov 2023", keywords:["alignment politics","values","power"], readingMinutes:16, theme:"AI Safety", type:"essay" },
  { id:"na17", title:"Is AI Safety Actually About Making AI Safe?", url:"https://theintercept.com/2023/10/04/ai-safety-openai-anthropic-google/", source:"The Intercept", published:"Oct 2023", keywords:["safety framing","corporate interests","alignment"], readingMinutes:12, theme:"AI Safety", type:"essay" },
  { id:"na18", title:"Why the AI Safety Movement Needs to Grow Up", url:"https://www.vox.com/future-perfect/2023/8/18/23836362/ai-safety-movement-criticism", source:"Vox", published:"Aug 2023", keywords:["ai safety movement","effective altruism","critique"], readingMinutes:11, theme:"AI Safety", type:"essay" },
  { id:"na19", title:"Situational Awareness: What to Expect from AGI", url:"https://situational-awareness.ai", source:"Leopold Aschenbrenner", published:"Jun 2024", keywords:["agi forecasting","intelligence explosion","national security"], readingMinutes:90, theme:"AI Safety", type:"essay" },
  { id:"na20", title:"Anthropic's Responsible Scaling Policy Explained", url:"https://www.anthropic.com/news/anthropics-responsible-scaling-policy", source:"Anthropic", published:"Sep 2023", keywords:["responsible scaling","safety levels","frontier models"], readingMinutes:10, theme:"AI Safety", type:"essay" },
  { id:"na21", title:"Big Tech's Guide to Talking About AI Accountability Without Having Any", url:"https://theintercept.com/2023/03/21/artificial-intelligence-big-tech-lobbying-accountability/", source:"The Intercept", published:"Mar 2023", keywords:["tech lobbying","ai regulation","accountability"], readingMinutes:10, theme:"AI Policy", type:"essay" },
  { id:"na22", title:"How the EU AI Act Will Reshape Artificial Intelligence Globally", url:"https://www.technologyreview.com/2023/06/12/1074449/eu-ai-act-artificial-intelligence/", source:"MIT Technology Review", published:"Jun 2023", keywords:["eu ai act","regulation","global governance"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na23", title:"How the FTC Became the Main AI Watchdog", url:"https://www.politico.com/news/2023/06/20/ftc-ai-watchdog-00102620", source:"Politico", published:"Jun 2023", keywords:["ftc","us regulation","antitrust"], readingMinutes:8, theme:"AI Policy", type:"essay" },
  { id:"na24", title:"Who Owns the Generative AI Platform?", url:"https://a16z.com/who-owns-the-generative-ai-platform/", source:"a16z", published:"Jan 2023", keywords:["platform power","commoditisation","market structure"], readingMinutes:11, theme:"AI Policy", type:"essay" },
  { id:"na25", title:"Silicon Valley's Lobbying Machine", url:"https://themarkup.org/news/2022/01/14/silicon-valleys-lobbying-machine", source:"The Markup", published:"Jan 2022", keywords:["tech lobbying","policy capture","washington"], readingMinutes:10, theme:"AI Policy", type:"essay" },
  { id:"na26", title:"Why Facial Recognition Technology Is So Hard to Regulate", url:"https://www.technologyreview.com/2022/03/07/1046979/facial-recognition-technology-hard-to-regulate/", source:"MIT Technology Review", published:"Mar 2022", keywords:["facial recognition","regulation","law enforcement"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na27", title:"The AI Governance Gap", url:"https://www.foreignaffairs.com/world/ai-governance-gap", source:"Foreign Affairs", published:"Dec 2023", keywords:["ai governance","international cooperation","regulatory gap"], readingMinutes:14, theme:"AI Policy", type:"essay" },
  { id:"na28", title:"OpenAI's Tumultuous Year and What It Means for AI Regulation", url:"https://www.wired.com/story/openai-altman-fired-board-regulation/", source:"Wired", published:"Nov 2023", keywords:["openai governance","board oversight","ai regulation"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na29", title:"Clearview AI Fined in UK for Facial Recognition Violations", url:"https://www.theguardian.com/technology/2022/may/23/clearview-ai-fined-in-uk-facial-recognition-database", source:"The Guardian", published:"May 2022", keywords:["facial recognition","privacy","gdpr"], readingMinutes:5, theme:"Governance", type:"essay" },
  { id:"na30", title:"How Amazon Sidewalk Became the Surveillance Network Next Door", url:"https://www.eff.org/deeplinks/2021/05/amazon-sidewalk-surveillance-network-next-door", source:"EFF", published:"May 2021", keywords:["amazon sidewalk","surveillance","iot"], readingMinutes:7, theme:"Governance", type:"essay" },
  { id:"na31", title:"Internet Governance: The Last Best Chance", url:"https://www.accessnow.org/internet-governance-last-best-chance/", source:"Access Now", published:"Dec 2022", keywords:["internet governance","multistakeholder","human rights"], readingMinutes:9, theme:"Governance", type:"essay" },
  { id:"na32", title:"The Quiet Ways Surveillance Is Spreading in Cities", url:"https://restofworld.org/2023/surveillance-cities-global-south/", source:"Rest of World", published:"Jul 2023", keywords:["urban surveillance","smart city","data rights"], readingMinutes:11, theme:"Governance", type:"essay" },
  { id:"na33", title:"Platform Regulation Is Coming — But Will It Work?", url:"https://www.technologyreview.com/2023/05/10/1072967/platform-regulation-eu-dsa-dma/", source:"MIT Technology Review", published:"May 2023", keywords:["dsa","dma","platform regulation"], readingMinutes:10, theme:"Governance", type:"essay" },
  { id:"na34", title:"The Digital Poorhouse", url:"https://harpers.org/archive/2018/01/the-digital-poorhouse/", source:"Harper's Magazine", published:"Jan 2018", keywords:["welfare surveillance","automated decisions","poverty"], readingMinutes:22, theme:"Digital Justice", type:"essay" },
  { id:"na35", title:"The Exploited Labor Behind Artificial Intelligence", url:"https://nymag.com/intelligencer/2023/04/the-hidden-workers-cleaning-up-after-ai.html", source:"New York Magazine", published:"Apr 2023", keywords:["data labelling","gig labour","global south"], readingMinutes:12, theme:"Digital Justice", type:"essay" },
  { id:"na36", title:"Inside the Bangladesh Factory Making AI Smarter", url:"https://restofworld.org/2023/appen-scale-ai-india-data-labeling/", source:"Rest of World", published:"May 2023", keywords:["data annotation","outsourcing","labour rights"], readingMinutes:10, theme:"Digital Justice", type:"essay" },
  { id:"na37", title:"Ghost Work: The Hidden Human Labor Behind AI", url:"https://www.theatlantic.com/technology/archive/2019/04/amazon-mechanical-turk-and-hidden-cost-ai/587594/", source:"The Atlantic", published:"Apr 2019", keywords:["ghost work","mechanical turk","invisible labour"], readingMinutes:11, theme:"Digital Justice", type:"essay" },
  { id:"na38", title:"Africa's Tech Future Shouldn't Be Decided in Silicon Valley", url:"https://restofworld.org/2023/africa-ai-policy-governance/", source:"Rest of World", published:"Oct 2023", keywords:["africa","ai sovereignty","tech policy"], readingMinutes:9, theme:"Digital Justice", type:"essay" },
  { id:"na39", title:"AI and the Global South: A Different Perspective", url:"https://www.aljazeera.com/opinions/2023/8/15/ai-and-the-global-south-a-different-perspective", source:"Al Jazeera", published:"Aug 2023", keywords:["global south","ai development","inequality"], readingMinutes:8, theme:"Digital Justice", type:"essay" },
  { id:"na40", title:"AI Hiring Tools May Be Filtering Out the Best Job Applicants", url:"https://www.bloomberg.com/news/articles/2023-02-08/ai-hiring-tools-may-be-filtering-out-the-best-job-applicants", source:"Bloomberg", published:"Feb 2023", keywords:["algorithmic hiring","bias","employment"], readingMinutes:7, theme:"Bias and Fairness", type:"essay" },
  { id:"na41", title:"People Keep Trusting AI Systems That Get Things Wrong", url:"https://themarkup.org/machine-learning/2023/03/22/people-keep-trusting-ai-systems-that-get-things-wrong", source:"The Markup", published:"Mar 2023", keywords:["automation bias","algorithmic trust","error rates"], readingMinutes:8, theme:"Bias and Fairness", type:"essay" },
  { id:"na42", title:"Predictive Policing Explained", url:"https://www.brennancenter.org/our-work/research-reports/predictive-policing-explained", source:"Brennan Center", published:"Apr 2020", keywords:["predictive policing","race","criminal justice"], readingMinutes:9, theme:"Bias and Fairness", type:"essay" },
  { id:"na43", title:"The Coded Gaze: Unmasking Algorithmic Bias", url:"https://www.media.mit.edu/articles/the-coded-gaze-unmasking-algorithmic-bias/", source:"MIT Media Lab", published:"Feb 2017", keywords:["facial analysis","racial bias","computer vision"], readingMinutes:8, theme:"Bias and Fairness", type:"essay" },
  { id:"na44", title:"Inside the Fight Over AI's Role in Criminal Sentencing", url:"https://themarkup.org/news/2023/05/10/inside-the-fight-over-ais-role-in-criminal-sentencing", source:"The Markup", published:"May 2023", keywords:["risk assessment tools","criminal justice","recidivism"], readingMinutes:10, theme:"Bias and Fairness", type:"essay" },
  { id:"na45", title:"Welcome to the Age of AI Colonialism", url:"https://theintercept.com/2023/07/11/ai-colonialism/", source:"The Intercept", published:"Jul 2023", keywords:["ai colonialism","global south","power asymmetry"], readingMinutes:13, theme:"Critical Computing", type:"essay" },
  { id:"na46", title:"Open Source AI Is the Path Forward — But for Whom?", url:"https://logicmag.io/distribution/open-source-ai/", source:"Logic Magazine", published:"Sep 2023", keywords:["open source","ai access","distribution"], readingMinutes:13, theme:"Critical Computing", type:"essay" },
  { id:"na47", title:"Resisting Reduction: A Manifesto", url:"https://jods.mitpress.mit.edu/pub/resisting-reduction/release/4", source:"MIT Press / JoDS", published:"Nov 2017", keywords:["techno-solutionism","complexity","systems thinking"], readingMinutes:15, theme:"Critical Computing", type:"essay" },
  { id:"na48", title:"The Automation Charade", url:"https://logicmag.io/failure/the-automation-charade/", source:"Logic Magazine", published:"Aug 2018", keywords:["automation myth","hidden labour","technology narrative"], readingMinutes:12, theme:"Critical Computing", type:"essay" },
  { id:"na49", title:"A.I. Chatbots Are Coming to Your Local Government", url:"https://www.nytimes.com/2023/07/18/technology/ai-local-government-chatbots.html", source:"New York Times", published:"Jul 2023", keywords:["local government","chatbots","public sector ai"], readingMinutes:8, theme:"Critical Computing", type:"essay" },
  { id:"na50", title:"When Algorithms Make Government Decisions, Who Appeals?", url:"https://www.aclu.org/news/privacy-technology/when-algorithms-make-government-decisions-who-appeals", source:"ACLU", published:"Mar 2023", keywords:["algorithmic decisions","due process","public sector"], readingMinutes:9, theme:"Critical Computing", type:"essay" },
  { id:"na51", title:"The Gentrification of the Internet", url:"https://logicmag.io/commons/the-gentrification-of-the-internet/", source:"Logic Magazine", published:"Oct 2019", keywords:["internet access","platform power","digital commons"], readingMinutes:14, theme:"Critical Computing", type:"essay" },
  { id:"na52", title:"The Myth of Neutral AI", url:"https://www.technologyreview.com/2021/03/05/1020376/what-is-neutral-in-ai/", source:"MIT Technology Review", published:"Mar 2021", keywords:["value-ladenness","ai neutrality myth","design choices"], readingMinutes:8, theme:"Critical Computing", type:"essay" },
  { id:"na53", title:"How Big Tech Is Importing India's Caste Bias", url:"https://restofworld.org/2022/caste-tech-bias/", source:"Rest of World", published:"Jul 2022", keywords:["caste discrimination","tech workplace","india"], readingMinutes:11, theme:"Bias and Fairness", type:"essay" },
  { id:"na54", title:"Disability and the Design of AI", url:"https://www.wired.com/story/disability-design-ai-accessibility/", source:"Wired", published:"Jun 2023", keywords:["disability","accessibility","ai design"], readingMinutes:9, theme:"Bias and Fairness", type:"essay" },
  { id:"na55", title:"The Invisible Labor of AI Art", url:"https://themarkup.org/hello-world/2023/01/12/the-invisible-labor-of-ai-art", source:"The Markup", published:"Jan 2023", keywords:["ai art","artists","copyright"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na56", title:"How Tech Companies Captured the AI Safety Debate", url:"https://www.theatlantic.com/technology/archive/2023/06/ai-regulation-sam-altman-congress-testimony/674450/", source:"The Atlantic", published:"Jun 2023", keywords:["ai safety capture","regulation theater","lobbying"], readingMinutes:10, theme:"AI Policy", type:"essay" },
  { id:"na57", title:"China's AI Governance Model", url:"https://www.technologyreview.com/2023/07/03/1075849/china-ai-regulation-explained/", source:"MIT Technology Review", published:"Jul 2023", keywords:["china","ai regulation","comparative governance"], readingMinutes:9, theme:"Governance", type:"essay" },
  { id:"na58", title:"Healthcare AI Is Coming — Are Hospitals Ready?", url:"https://themarkup.org/news/2023/03/07/healthcare-ai-is-coming-are-hospitals-ready", source:"The Markup", published:"Mar 2023", keywords:["healthcare ai","clinical decision support","hospital systems"], readingMinutes:10, theme:"Bias and Fairness", type:"essay" },
  { id:"na59", title:"Who Gets to Build the AI Future?", url:"https://restofworld.org/2023/who-builds-ai-global-diversity/", source:"Rest of World", published:"Nov 2023", keywords:["ai workforce","diversity","global representation"], readingMinutes:10, theme:"Critical Computing", type:"essay" },
  { id:"na60", title:"Structural Racism in AI Needs Structural Solutions", url:"https://www.technologyreview.com/2021/09/14/1036100/structural-racism-in-ai-structural-solutions/", source:"MIT Technology Review", published:"Sep 2021", keywords:["structural racism","ai systems","systemic change"], readingMinutes:9, theme:"Critical Computing", type:"essay" },
  { id:"ac1",  title:"Concrete Problems in AI Safety", url:"https://arxiv.org/abs/1606.06565", source:"Amodei et al.", published:"Jun 2016", keywords:["reward hacking","safe exploration","scalable oversight"], readingMinutes:40, theme:"AI Safety", year:"2016", type:"foundational" },
  { id:"ac2",  title:"Fairness and Abstraction in Sociotechnical Systems", url:"https://dl.acm.org/doi/10.1145/3287560.3287598", source:"Selbst et al.", published:"Jan 2019", keywords:["algorithmic fairness","sociotechnical systems","abstraction"], readingMinutes:35, theme:"Bias and Fairness", year:"2019", type:"foundational" },
  { id:"ac3",  title:"On the Dangers of Stochastic Parrots", url:"https://dl.acm.org/doi/10.1145/3442188.3445922", source:"Bender, Gebru et al.", published:"Mar 2021", keywords:["language model risks","environmental cost","value alignment"], readingMinutes:38, theme:"Ethics", year:"2021", type:"foundational" },
  { id:"ac4",  title:"Decolonial AI: Decolonial Theory as Sociotechnical Foresight", url:"https://link.springer.com/article/10.1007/s13347-020-00405-8", source:"Mohamed et al.", published:"Jun 2020", keywords:["decolonial theory","power","ai ethics"], readingMinutes:35, theme:"Critical Computing", year:"2020", type:"foundational" },
  { id:"ac5",  title:"Risks from Learned Optimization in Advanced Machine Learning", url:"https://arxiv.org/abs/1906.01820", source:"Hubinger et al.", published:"Jun 2019", keywords:["mesa-optimisation","deceptive alignment","inner alignment"], readingMinutes:45, theme:"AI Safety", year:"2019", type:"foundational" },
  { id:"ac6",  title:"Datasheets for Datasets", url:"https://arxiv.org/abs/1803.09010", source:"Gebru et al.", published:"Mar 2018", keywords:["dataset documentation","transparency","accountability"], readingMinutes:28, theme:"Bias and Fairness", year:"2021", type:"foundational" },
  { id:"ac7",  title:"Reward is Enough", url:"https://www.sciencedirect.com/science/article/pii/S0004370221000862", source:"Silver et al.", published:"Jun 2021", keywords:["reward maximisation","general intelligence","agency"], readingMinutes:35, theme:"AI Safety", year:"2021", type:"foundational" },
  { id:"ac8",  title:"Model Cards for Model Reporting", url:"https://arxiv.org/abs/1810.03993", source:"Mitchell et al.", published:"Oct 2018", keywords:["model cards","transparency","documentation"], readingMinutes:22, theme:"Ethics", year:"2019", type:"foundational" },
  { id:"ac9",  title:"Big Data's Disparate Impact", url:"https://doi.org/10.2139/ssrn.2477899", source:"Barocas and Selbst", published:"Apr 2016", keywords:["big data","discrimination","legal frameworks"], readingMinutes:30, theme:"Bias and Fairness", year:"2016", type:"foundational" },
  { id:"ac10", title:"Specification Gaming: The Flip Side of AI Ingenuity", url:"https://arxiv.org/abs/2001.09768", source:"Krakovna et al.", published:"Jan 2020", keywords:["specification gaming","reward misalignment","examples"], readingMinutes:25, theme:"AI Safety", year:"2020", type:"foundational" },
  { id:"ac11", title:"Value Alignment or Misalignment — What Will Keep AI Safe?", url:"https://arxiv.org/abs/1811.07871", source:"Russell et al.", published:"Nov 2018", keywords:["value alignment","corrigibility","human preferences"], readingMinutes:30, theme:"AI Safety", year:"2018", type:"foundational" },
  { id:"ac12", title:"The Ethics of Artificial Intelligence", url:"https://www.nickbostrom.com/ethics/artificial-intelligence.pdf", source:"Bostrom and Cirkovic", published:"Jan 2014", keywords:["superintelligence","moral status","long-run risks"], readingMinutes:40, theme:"Ethics", year:"2014", type:"foundational" },
  { id:"ac13", title:"Interpretable Machine Learning", url:"https://arxiv.org/abs/1901.04592", source:"Molnar", published:"Jan 2019", keywords:["interpretability","explainability","black box"], readingMinutes:50, theme:"Bias and Fairness", year:"2019", type:"foundational" },
  { id:"ac14", title:"A Unified Approach to Interpreting Model Predictions (SHAP)", url:"https://arxiv.org/abs/1705.07874", source:"Lundberg and Lee", published:"May 2017", keywords:["shap values","feature importance","model explanation"], readingMinutes:30, theme:"Bias and Fairness", year:"2017", type:"foundational" },
  { id:"ac15", title:"Internet Governance: The New Frontier", url:"https://doi.org/10.1007/978-3-319-76448-9", source:"DeNardis", published:"Mar 2014", keywords:["internet governance","iana","global institutions"], readingMinutes:40, theme:"Governance", year:"2014", type:"foundational" },
  { id:"ac16", title:"A Survey of Safety and Trustworthiness of Large Language Models", url:"https://arxiv.org/abs/2305.11391", source:"Huang et al.", published:"May 2023", keywords:["llm safety","trustworthiness","red teaming"], readingMinutes:50, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac17", title:"Constitutional AI: Harmlessness from AI Feedback", url:"https://arxiv.org/abs/2212.08073", source:"Bai et al.", published:"Dec 2022", keywords:["rlhf","harmlessness","constitutional ai"], readingMinutes:40, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac18", title:"Toward a Critical Race Theory of Algorithmic Systems", url:"https://dl.acm.org/doi/10.1145/3531146.3533170", source:"Benjamin", published:"Jun 2022", keywords:["critical race theory","algorithms","structural racism"], readingMinutes:30, theme:"Bias and Fairness", year:"2022", type:"recent" },
  { id:"ac19", title:"Computing Power and the Governance of Artificial Intelligence", url:"https://arxiv.org/abs/2402.08797", source:"Heim et al.", published:"Feb 2024", keywords:["compute governance","chip controls","export policy"], readingMinutes:35, theme:"Governance", year:"2024", type:"recent" },
  { id:"ac20", title:"Predictability and Surprise in Large Generative Models", url:"https://arxiv.org/abs/2202.07785", source:"Ganguli et al.", published:"Feb 2022", keywords:["emergent capabilities","scaling","unpredictability"], readingMinutes:30, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac21", title:"The Social and Environmental Impacts of AI in the Global South", url:"https://arxiv.org/abs/2306.16338", source:"Sambasivan et al.", published:"Jun 2023", keywords:["global south","data colonialism","environmental justice"], readingMinutes:32, theme:"Critical Computing", year:"2023", type:"recent" },
  { id:"ac22", title:"Measuring the Carbon Intensity of AI in Cloud Instances", url:"https://arxiv.org/abs/2206.05229", source:"Dodge et al.", published:"Jun 2022", keywords:["carbon intensity","cloud computing","ai emissions"], readingMinutes:28, theme:"Environment", year:"2022", type:"recent" },
  { id:"ac23", title:"Evaluating Language Models for Dangerous Capabilities", url:"https://arxiv.org/abs/2403.13793", source:"Anthropic", published:"Mar 2024", keywords:["capability evaluation","dangerous tasks","red teaming"], readingMinutes:35, theme:"AI Safety", year:"2024", type:"recent" },
  { id:"ac24", title:"An Overview of Catastrophic AI Risks", url:"https://arxiv.org/abs/2306.12001", source:"Hendrycks et al.", published:"Jun 2023", keywords:["catastrophic risk","misuse","structural risks"], readingMinutes:38, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac25", title:"Sparks of Artificial General Intelligence: GPT-4 Experiments", url:"https://arxiv.org/abs/2303.12528", source:"Bubeck et al.", published:"Mar 2023", keywords:["agi","gpt-4","reasoning"], readingMinutes:60, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac26", title:"Towards a Framework for AI Transparency", url:"https://arxiv.org/abs/2312.02213", source:"Bommasani et al.", published:"Dec 2023", keywords:["transparency","foundation models","disclosure"], readingMinutes:30, theme:"Governance", year:"2023", type:"recent" },
  { id:"ac27", title:"The ROOTS Search Tool: Data Governance for LLMs", url:"https://arxiv.org/abs/2302.14035", source:"Piktus et al.", published:"Feb 2023", keywords:["data governance","training data","llm transparency"], readingMinutes:25, theme:"Ethics", year:"2023", type:"recent" },
  { id:"ac28", title:"Preventing Discrimination from AI in Hiring", url:"https://arxiv.org/abs/2305.04412", source:"Raghavan et al.", published:"May 2023", keywords:["hiring discrimination","fairness","legal compliance"], readingMinutes:28, theme:"Bias and Fairness", year:"2023", type:"recent" },
  { id:"ac29", title:"Power-Seeking Can Be Dangerous and Instrumental", url:"https://arxiv.org/abs/1912.01683", source:"Turner et al.", published:"Dec 2019", keywords:["power seeking","instrumental convergence","corrigibility"], readingMinutes:32, theme:"AI Safety", year:"2021", type:"recent" },
  { id:"ac30", title:"Governing AI: Understanding the Limits of Ethics Codes", url:"https://doi.org/10.1145/3351095.3372873", source:"Mittelstadt", published:"Jan 2019", keywords:["ai ethics codes","self-regulation","limits"], readingMinutes:28, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac31", title:"Algorithmic Impact Assessments and Accountability", url:"https://arxiv.org/abs/1912.09912", source:"Reisman et al.", published:"Dec 2019", keywords:["impact assessment","accountability","audit"], readingMinutes:30, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac32", title:"Energy and Policy Considerations for Deep Learning in NLP", url:"https://arxiv.org/abs/1906.02629", source:"Strubell et al.", published:"Jun 2019", keywords:["nlp energy","carbon footprint","compute costs"], readingMinutes:25, theme:"Environment", year:"2019", type:"recent" },
  { id:"ac33", title:"Quantifying the Carbon Emissions of Machine Learning", url:"https://arxiv.org/abs/1910.09700", source:"Lacoste et al.", published:"Oct 2019", keywords:["carbon tracker","ml emissions","reporting"], readingMinutes:22, theme:"Environment", year:"2019", type:"recent" },
  { id:"ac34", title:"Participatory Approaches to Machine Learning", url:"https://arxiv.org/abs/2012.04071", source:"Birhane et al.", published:"Dec 2020", keywords:["participatory design","community input","ml governance"], readingMinutes:28, theme:"Critical Computing", year:"2020", type:"recent" },
  { id:"ac35", title:"The Values Encoded in Machine Learning Research", url:"https://arxiv.org/abs/2106.15590", source:"Birhane et al.", published:"Jun 2021", keywords:["research values","ml culture","implicit assumptions"], readingMinutes:30, theme:"Ethics", year:"2022", type:"recent" },
  { id:"ac36", title:"Digital Colonialism and the Internet as a Tool of Cultural Hegemony", url:"https://doi.org/10.1080/1369118X.2020.1728563", source:"Kwet", published:"Feb 2019", keywords:["digital colonialism","internet hegemony","tech sovereignty"], readingMinutes:35, theme:"Digital Justice", year:"2019", type:"recent" },
  { id:"ac37", title:"Harms of AI and the Duty to Prevent Them", url:"https://arxiv.org/abs/2202.07025", source:"Weidinger et al.", published:"Feb 2022", keywords:["ai harms taxonomy","risk framework","duty of care"], readingMinutes:35, theme:"Ethics", year:"2022", type:"recent" },
  { id:"ac38", title:"Do Large Language Models Know What They Don't Know?", url:"https://arxiv.org/abs/2305.18153", source:"Kadavath et al.", published:"May 2023", keywords:["calibration","uncertainty","epistemic honesty"], readingMinutes:28, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac39", title:"AI and the Concentration of Power", url:"https://doi.org/10.1146/annurev-polisci-051921-102109", source:"Dafoe", published:"May 2018", keywords:["power concentration","political economy","ai geopolitics"], readingMinutes:35, theme:"AI Policy", year:"2018", type:"recent" },
  { id:"ac40", title:"Data Feminism", url:"https://doi.org/10.7551/mitpress/11805.001.0001", source:"D'Ignazio and Klein", published:"Mar 2020", keywords:["feminist data science","power in data","intersectionality"], readingMinutes:40, theme:"Digital Justice", year:"2020", type:"recent" },
  { id:"ac41", title:"AI and Human Rights", url:"https://arxiv.org/abs/1912.05848", source:"Raso et al.", published:"Dec 2019", keywords:["human rights framework","ai accountability","legal standards"], readingMinutes:30, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac42", title:"Participatory Design for Fairness", url:"https://dl.acm.org/doi/10.1145/3351095.3372873", source:"Lee et al.", published:"Jan 2019", keywords:["participatory design","fairness","co-design"], readingMinutes:26, theme:"Bias and Fairness", year:"2019", type:"recent" },
  { id:"ac43", title:"Language Models (Mostly) Know What They Know", url:"https://arxiv.org/abs/2207.05221", source:"Kadavath et al.", published:"Jul 2022", keywords:["self-knowledge","calibration","language models"], readingMinutes:28, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac44", title:"Ethical and Social Risks of Harm from Language Models", url:"https://arxiv.org/abs/2112.04359", source:"Weidinger et al.", published:"Dec 2021", keywords:["llm risks","social harm","ethics taxonomy"], readingMinutes:32, theme:"Ethics", year:"2021", type:"recent" },
];

// ─── Shared tiny components ───────────────────────────────────────────────────

const F = { fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" };

function Pill({ children, color, small }) {
  return <span style={{ fontSize: small?"8px":"9px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 7px", borderRadius:"2px", background:color+"22", color, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}

function TabBar({ active, onChange }) {
  const tabs = [
    { id:"dispatch", label:"Dispatch" },
    { id:"garden",   label:"Garden" },
    { id:"stats",    label:"Stats" },
    { id:"add",      label:"+ Add Source" },
  ];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, height:"100%" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ ...F, height:"100%", padding:"0 20px", background:"transparent", border:"none", borderBottom: active===t.id ? "2px solid #8B6508":"2px solid transparent", color: active===t.id ? "#2C2416":"#6B5035", fontSize:"12px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", transition:"color 0.15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Notes modal ──────────────────────────────────────────────────────────────

function NotesModal({ item, notes, onSave, onClose }) {
  const existing = notes[item.url] || { argument:"", thoughts:"" };
  const [arg, setArg]     = useState(existing.argument);
  const [tho, setTho]     = useState(existing.thoughts);
  const c = COLOR[item.theme] || "#6B5035";
  const hasContent = arg.trim() || tho.trim();

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(40,25,10,0.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...F, background:"#F5F0E8", border:"1px solid rgba(60,40,20,0.24)", borderRadius:"6px", width:"100%", maxWidth:"540px", maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid rgba(60,40,20,0.32)", display:"flex", alignItems:"flex-start", gap:"10px" }}>
          <div style={{ flex:1 }}>
            <Pill color={c}>{item.theme}</Pill>
            <div style={{ fontSize:"14px", color:"#2C2416", marginTop:"7px", lineHeight:1.4, fontWeight:500 }}>{item.title}</div>
            <div style={{ fontSize:"11px", color:"#3D2B1A", fontStyle:"italic", marginTop:"3px" }}>{item.source} · {item.published}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#2C2416", cursor:"pointer", fontSize:"20px", flexShrink:0 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"10px", color:"#6B5035", letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:"6px" }}>What is being argued?</label>
            <textarea value={arg} onChange={e => setArg(e.target.value)} placeholder="Summarise the core argument…" rows={4}
              style={{ ...F, width:"100%", background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.25)", borderRadius:"3px", color:"#2C2416", fontSize:"13px", padding:"9px 11px", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }} />
          </div>
          <div>
            <label style={{ fontSize:"10px", color:"#3D2B1A", letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:"6px" }}>My thoughts / response</label>
            <textarea value={tho} onChange={e => setTho(e.target.value)} placeholder="Your reaction, critique, connections to other ideas…" rows={5}
              style={{ ...F, width:"100%", background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.25)", borderRadius:"3px", color:"#2C2416", fontSize:"13px", padding:"9px 11px", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }} />
          </div>
        </div>
        <div style={{ padding:"12px 18px", borderTop:"1px solid rgba(60,40,20,0.18)", display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          {hasContent && <button onClick={() => { onSave(item.url, null); onClose(); }} style={{ ...F, background:"transparent", border:"1px solid rgba(180,60,0,0.3)", color:"#C04E00", padding:"6px 14px", borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Delete note</button>}
          <button onClick={onClose} style={{ ...F, background:"transparent", border:"1px solid rgba(60,40,20,0.32)", color:"#6B5035", padding:"6px 14px", borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
          <button onClick={() => { onSave(item.url, { argument:arg, thoughts:tho }); onClose(); }} style={{ ...F, background:"transparent", border:"1px solid #8B6508", color:"#8B6508", padding:"6px 14px", borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Save note</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dispatch item row ────────────────────────────────────────────────────────

function DispatchItem({ item, show, idx, readItems, onToggleRead, notes, onOpenNote }) {
  const c = COLOR[item.theme] || "#6B5035";
  const isRead = readItems.has(item.url);
  const hasNote = !!(notes[item.url]?.argument || notes[item.url]?.thoughts);
  return (
    <div style={{ opacity:show?(isRead?0.42:1):0, transform:show?"none":"translateY(8px)", transition:`opacity 0.35s ease ${idx*0.06}s, transform 0.35s ease ${idx*0.06}s`, borderBottom:"1px solid rgba(60,40,20,0.28)", paddingBottom:"18px", marginBottom:"18px" }}>
      <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", alignItems:"center", marginBottom:"7px" }}>
        <Pill color={c}>{item.theme}</Pill>
        {item.year && <Pill color={item.type==="foundational"?"#F97316":"#60A5FA"}>{item.type==="foundational"?"Foundational":item.year}</Pill>}
        {item.custom && <Pill color="#A78BFA">Custom</Pill>}
        <span style={{ fontSize:"10px", color:"#2C2416" }}>{item.published}</span>
        <span style={{ fontSize:"10px", color:"#2C2416", marginLeft:"auto" }}>{item.readingMinutes} min</span>
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize:"15px", color:isRead?"#3A2518":"#2C2416", textDecoration:isRead?"line-through":"none", textDecorationColor:"#444", display:"block", lineHeight:"1.4", marginBottom:"8px", fontWeight:500, transition:"color 0.15s", ...F }}
        onMouseEnter={e => { if(!isRead) e.currentTarget.style.color=c; }}
        onMouseLeave={e => { if(!isRead) e.currentTarget.style.color="#2C2416"; }}>
        {item.title} <span style={{ opacity:0.3, fontSize:"11px" }}>↗</span>
      </a>
      <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"11px", color:"#3D2B1A", fontStyle:"italic" }}>{item.source}</span>
        <span style={{ color:"#3A2518" }}>·</span>
        {item.keywords.map((kw,j) => <span key={j} style={{ fontSize:"10px", color:"#3D2B1A", background:"rgba(60,40,20,0.32)", border:"1px solid rgba(60,40,20,0.25)", padding:"1px 6px", borderRadius:"2px" }}>#{kw}</span>)}
        <div style={{ marginLeft:"auto", display:"flex", gap:"5px" }}>
          <button onClick={() => onOpenNote(item)}
            style={{ ...F, background: hasNote?"rgba(184,134,11,0.08)":"rgba(60,40,20,0.07)", border: hasNote?"1px solid rgba(184,134,11,0.35)":"1px solid rgba(60,40,20,0.28)", borderRadius:"3px", padding:"2px 8px", cursor:"pointer", fontSize:"10px", letterSpacing:"0.07em", textTransform:"uppercase", color: hasNote?"#8B6508":"#6B5035" }}>
            {hasNote ? "✎ Note" : "Note"}
          </button>
          <button onClick={() => onToggleRead(item.url)}
            style={{ ...F, background: isRead?"rgba(26,122,94,0.08)":"rgba(60,40,20,0.07)", border: isRead?"1px solid rgba(26,122,94,0.4)":"1px solid rgba(60,40,20,0.28)", borderRadius:"3px", padding:"2px 8px", cursor:"pointer", fontSize:"10px", letterSpacing:"0.07em", textTransform:"uppercase", color: isRead?"#1A7A5E":"#6B5035" }}>
            {isRead ? "✓ Read" : "To Read"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dispatch view ────────────────────────────────────────────────────────────

function DispatchView({ pool, readItems, onToggleRead, notes, onSaveNote }) {
  const [date, setDate]         = useState(todayStr());
  const [issue, setIssue]       = useState(null);
  const [show, setShow]         = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerVal, setPickerVal]   = useState(todayStr());
  const [noteItem, setNoteItem]     = useState(null);

  function load(d) {
    setShow(false);
    setDate(d);
    setIssue(getDispatch(d, pool));
    setTimeout(() => setShow(true), 60);
  }

  const isToday = date === todayStr();
  const allItems = issue ? [...issue.nonAcademic, ...issue.academic] : [];
  const readCount = allItems.filter(i => readItems.has(i.url)).length;

  return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"0 24px 80px" }}>
      {/* Date header */}
      <div style={{ paddingTop:"32px", paddingBottom:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
          <button onClick={() => load(prevDay(date))} style={NAV}>←</button>
          <button onClick={() => { setPickerVal(date); setShowPicker(v=>!v); }} style={{ ...F, background:"transparent", border:"none", cursor:"pointer", padding:"0 2px" }}>
            <span style={{ fontSize:"14px", color: isToday?"#8B6508":"#3D2B1A", fontStyle:"italic", borderBottom:"1px dashed currentColor", opacity:0.85 }}>{fmtDate(date)}</span>
          </button>
          <button onClick={() => { if(!isToday) load(nextDay(date)); }} style={{ ...NAV, opacity:isToday?0.2:1, cursor:isToday?"default":"pointer" }}>→</button>
          {!isToday && <button onClick={() => load(todayStr())} style={{ ...F, fontSize:"9px", letterSpacing:"0.12em", textTransform:"uppercase", background:"transparent", border:"1px solid rgba(184,134,11,0.35)", color:"#8B6508", padding:"3px 9px", borderRadius:"2px", cursor:"pointer" }}>Today</button>}
          {issue && <span style={{ fontSize:"11px", color:"#1A120A", marginLeft:"auto", fontStyle:"italic" }}>{readCount}/{allItems.length} read</span>}
        </div>

        {showPicker && (
          <div style={{ marginBottom:"16px", background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.25)", borderRadius:"4px", padding:"11px 14px", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"10px", color:"#3D2B1A", textTransform:"uppercase", letterSpacing:"0.1em" }}>Jump to</span>
            <input type="date" value={pickerVal} max={todayStr()} onChange={e=>setPickerVal(e.target.value)}
              style={{ background:"transparent", border:"1px solid rgba(60,40,20,0.32)", borderRadius:"3px", color:"#2C2416", padding:"4px 8px", fontSize:"13px", ...F }} />
            <button onClick={() => { if(pickerVal){load(pickerVal);setShowPicker(false);} }}
              style={{ ...F, background:"transparent", border:"1px solid #8B6508", color:"#8B6508", padding:"4px 12px", borderRadius:"3px", cursor:"pointer", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase" }}>Go</button>
            <button onClick={() => setShowPicker(false)} style={{ background:"transparent", border:"none", color:"#2C2416", cursor:"pointer", fontSize:"18px", marginLeft:"auto" }}>×</button>
          </div>
        )}

        {/* Theme pills */}
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"20px" }}>
          {THEMES.map(t => <span key={t.name} style={{ fontSize:"9px", letterSpacing:"0.08em", textTransform:"uppercase", padding:"3px 7px", borderRadius:"2px", border:"1px solid "+t.color+"40", color:t.color+"99" }}>{t.name}</span>)}
        </div>

        {!issue && (
          <button onClick={() => load(date)} style={{ ...F, padding:"11px 26px", background:"transparent", border:"1px solid #8B6508", color:"#8B6508", fontSize:"11px", letterSpacing:"0.15em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px" }}>
            Generate Today's Dispatch
          </button>
        )}
      </div>

      {issue && (
        <>
          {/* Progress bar */}
          <div style={{ height:"2px", background:"rgba(60,40,20,0.32)", borderRadius:"1px", marginBottom:"26px", overflow:"hidden", opacity:show?1:0, transition:"opacity 0.4s ease 0.2s" }}>
            <div style={{ height:"100%", width:`${allItems.length?(readCount/allItems.length)*100:0}%`, background:"linear-gradient(90deg,#1A7A5E,#1A5EA8)", transition:"width 0.5s", borderRadius:"1px" }} />
          </div>

          {/* Section I */}
          <div style={{ marginBottom:"40px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px", paddingBottom:"10px", borderBottom:"1px solid rgba(184,134,11,0.2)" }}>
              <span style={{ fontSize:"10px", color:"#8B6508", letterSpacing:"0.18em", textTransform:"uppercase" }}>I — In the Field</span>
              <span style={{ fontSize:"11px", color:"#6B5035", fontStyle:"italic" }}>Essays · Reports · Journalism</span>
            </div>
            {issue.nonAcademic.map((item,i) => <DispatchItem key={item.url} item={item} show={show} idx={i} readItems={readItems} onToggleRead={onToggleRead} notes={notes} onOpenNote={setNoteItem} />)}
          </div>

          {/* Section II */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px", paddingBottom:"10px", borderBottom:"1px solid rgba(26,94,168,0.18)" }}>
              <span style={{ fontSize:"10px", color:"#1A5EA8", letterSpacing:"0.18em", textTransform:"uppercase" }}>II — The Literature</span>
              <span style={{ fontSize:"11px", color:"#2C2416", fontStyle:"italic" }}>Papers · Foundational works</span>
            </div>
            {issue.academic.map((item,i) => <DispatchItem key={item.url} item={item} show={show} idx={i} readItems={readItems} onToggleRead={onToggleRead} notes={notes} onOpenNote={setNoteItem} />)}
          </div>

          <div style={{ marginTop:"40px", paddingTop:"14px", borderTop:"1px solid rgba(60,40,20,0.14)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"8px", opacity:show?1:0, transition:"opacity 0.4s ease 0.6s" }}>
            <span style={{ fontSize:"10px", color:"#3A2518", fontStyle:"italic" }}>{pool.length} items in pool · rotates daily</span>
            <button onClick={() => load(date)} style={{ ...F, background:"transparent", border:"1px solid rgba(60,40,20,0.28)", color:"#6B5035", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"4px 11px", cursor:"pointer", borderRadius:"2px" }}>Reshuffle</button>
          </div>
        </>
      )}

      {noteItem && <NotesModal item={noteItem} notes={notes} onSave={onSaveNote} onClose={() => setNoteItem(null)} />}
    </div>
  );
}

// ─── Add Source view ──────────────────────────────────────────────────────────

function AddSourceView({ pool, onAdd, onDelete }) {
  const allKeywords = useMemo(() => {
    const s = new Set();
    pool.forEach(p => p.keywords.forEach(k => s.add(k)));
    return [...s].sort();
  }, [pool]);

  const [form, setForm] = useState({ title:"", url:"", source:"", published:"", readingMinutes:"", theme:THEMES[0].name, type:"essay", year:"", keywords:[] });
  const [kwInput, setKwInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  function addKw(kw) {
    const clean = kw.trim().toLowerCase();
    if(clean && !form.keywords.includes(clean)) set("keywords",[...form.keywords, clean]);
    setKwInput("");
  }

  function validate() {
    const e = {};
    if(!form.title.trim()) e.title = "Required";
    if(!form.url.trim()) e.url = "Required";
    if(!form.source.trim()) e.source = "Required";
    if(!form.published.trim()) e.published = "Required";
    if(!form.readingMinutes || isNaN(parseInt(form.readingMinutes))) e.readingMinutes = "Must be a number";
    if(form.keywords.length === 0) e.keywords = "Add at least one keyword";
    return e;
  }

  function submit() {
    const e = validate();
    if(Object.keys(e).length) { setErrors(e); return; }
    const newItem = {
      id: "custom_" + Date.now(),
      title: form.title.trim(),
      url: form.url.trim(),
      source: form.source.trim(),
      published: form.published.trim(),
      readingMinutes: parseInt(form.readingMinutes),
      theme: form.theme,
      type: form.type,
      year: form.type !== "essay" ? form.year : undefined,
      keywords: form.keywords,
      custom: true,
    };
    onAdd(newItem);
    setForm({ title:"", url:"", source:"", published:"", readingMinutes:"", theme:THEMES[0].name, type:"essay", year:"", keywords:[] });
    setErrors({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const customItems = pool.filter(p => p.custom);
  const inputStyle = { ...F, width:"100%", background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.28)", borderRadius:"3px", color:"#2C2416", fontSize:"13px", padding:"8px 10px", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:"10px", color:"#6B5035", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:"5px" };
  const errStyle   = { fontSize:"10px", color:"#F97316", marginTop:"3px" };

  return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"24px 24px 80px" }}>
      <div style={{ marginBottom:"28px" }}>
        <h2 style={{ fontSize:"20px", color:"#2C2416", fontWeight:400, margin:"0 0 6px", letterSpacing:"-0.01em" }}>Add a Source</h2>
        <p style={{ fontSize:"13px", color:"#6B5035", fontStyle:"italic", margin:0 }}>New sources enter the pool immediately and will appear in future dispatches and the garden.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"14px" }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Full title of the piece" style={inputStyle} />
          {errors.title && <div style={errStyle}>{errors.title}</div>}
        </div>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={labelStyle}>URL *</label>
          <input value={form.url} onChange={e=>set("url",e.target.value)} placeholder="https://..." style={inputStyle} />
          {errors.url && <div style={errStyle}>{errors.url}</div>}
        </div>
        <div>
          <label style={labelStyle}>Source / Author *</label>
          <input value={form.source} onChange={e=>set("source",e.target.value)} placeholder="e.g. The Markup, Gebru et al." style={inputStyle} />
          {errors.source && <div style={errStyle}>{errors.source}</div>}
        </div>
        <div>
          <label style={labelStyle}>Published *</label>
          <input value={form.published} onChange={e=>set("published",e.target.value)} placeholder="e.g. Mar 2024" style={inputStyle} />
          {errors.published && <div style={errStyle}>{errors.published}</div>}
        </div>
        <div>
          <label style={labelStyle}>Reading time (minutes) *</label>
          <input value={form.readingMinutes} onChange={e=>set("readingMinutes",e.target.value)} type="number" min="1" placeholder="e.g. 12" style={inputStyle} />
          {errors.readingMinutes && <div style={errStyle}>{errors.readingMinutes}</div>}
        </div>
        <div>
          <label style={labelStyle}>Theme *</label>
          <select value={form.theme} onChange={e=>set("theme",e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            <option value="essay">Essay / Article / Report</option>
            <option value="recent">Academic — Recent paper</option>
            <option value="foundational">Academic — Foundational</option>
          </select>
        </div>
        {form.type !== "essay" && (
          <div>
            <label style={labelStyle}>Year</label>
            <input value={form.year} onChange={e=>set("year",e.target.value)} placeholder="e.g. 2023" style={inputStyle} />
          </div>
        )}
      </div>

      {/* Keywords */}
      <div style={{ marginBottom:"20px" }}>
        <label style={labelStyle}>Keywords * (3 recommended)</label>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px" }}>
          {form.keywords.map((kw,i) => (
            <span key={i} style={{ fontSize:"11px", color:"#8B6508", background:"rgba(184,134,11,0.08)", border:"1px solid rgba(184,134,11,0.3)", padding:"2px 8px", borderRadius:"2px", display:"flex", alignItems:"center", gap:"5px" }}>
              #{kw}
              <button onClick={() => set("keywords",form.keywords.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:"#8B6508", cursor:"pointer", fontSize:"12px", padding:0, lineHeight:1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <input value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){ e.preventDefault(); addKw(kwInput); }}}
            placeholder="Type a keyword and press Enter" style={{ ...inputStyle, flex:1 }} list="kw-suggestions" />
          <datalist id="kw-suggestions">{allKeywords.map(k=><option key={k} value={k}/>)}</datalist>
          <button onClick={() => addKw(kwInput)} style={{ ...F, background:"transparent", border:"1px solid rgba(60,40,20,0.32)", color:"#6B5035", padding:"0 14px", borderRadius:"3px", cursor:"pointer", fontSize:"11px", whiteSpace:"nowrap" }}>Add</button>
        </div>
        <div style={{ fontSize:"10px", color:"#6B5035", marginTop:"5px" }}>Pick from existing or type new ones. Shared keywords create edges in the Garden.</div>
        {errors.keywords && <div style={errStyle}>{errors.keywords}</div>}
      </div>

      <button onClick={submit} style={{ ...F, padding:"10px 28px", background:"transparent", border:"1px solid #8B6508", color:"#8B6508", fontSize:"11px", letterSpacing:"0.15em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px", marginBottom:"8px" }}>
        Add to Pool
      </button>
      {saved && <span style={{ fontSize:"12px", color:"#1A7A5E", marginLeft:"12px" }}>✓ Added successfully</span>}

      {/* Custom items list */}
      {customItems.length > 0 && (
        <div style={{ marginTop:"36px" }}>
          <div style={{ fontSize:"10px", color:"#6B5035", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"14px" }}>Your custom sources ({customItems.length})</div>
          {customItems.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:"12px", borderBottom:"1px solid rgba(60,40,20,0.28)", paddingBottom:"12px", marginBottom:"12px" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", gap:"5px", marginBottom:"4px" }}>
                  <Pill color={COLOR[item.theme]||"#6B5035"}>{item.theme}</Pill>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:"13px", color:"#2C2416", textDecoration:"none", display:"block", marginBottom:"3px" }}>{item.title} ↗</a>
                <div style={{ fontSize:"11px", color:"#3D2B1A", fontStyle:"italic" }}>{item.source} · {item.published} · {item.readingMinutes} min</div>
              </div>
              <button onClick={() => onDelete(item.id)} style={{ ...F, background:"transparent", border:"1px solid rgba(180,60,0,0.25)", color:"#C04E00", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Garden / graph view ──────────────────────────────────────────────────────

function buildLinks(items) {
  const kwMap = {};
  items.forEach(n => n.keywords.forEach(kw => { if(!kwMap[kw]) kwMap[kw]=[]; kwMap[kw].push(n.id); }));
  const links = [];
  const seen = new Set();
  Object.entries(kwMap).forEach(([kw,ids]) => {
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) {
      const key = [ids[i],ids[j]].sort().join("||");
      const ex = links.find(l => [l.source,l.target].sort().join("||")===key);
      if(ex) ex.keywords.push(kw); else { seen.add(key); links.push({source:ids[i],target:ids[j],keywords:[kw]}); }
    }
  });
  return links;
}

function GardenSidebar({ node, onClose, readItems, onToggleRead, notes, onOpenNote, connectedTitles, onNavigate }) {
  if(!node) return null;
  const c = COLOR[node.theme]||"#6B5035";
  const isRead = readItems.has(node.url);
  const hasNote = !!(notes[node.url]?.argument||notes[node.url]?.thoughts);
  const noteData = notes[node.url];
  return (
    <div style={{ ...F, position:"absolute", top:0, right:0, bottom:0, width:"290px", background:"rgba(235,228,215,1.0)", borderLeft:"1px solid rgba(60,40,20,0.24)", zIndex:30, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid rgba(60,40,20,0.32)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px" }}>
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
          <Pill color={c}>{node.theme}</Pill>
          {node.year && <Pill color={node.type==="foundational"?"#F97316":"#60A5FA"}>{node.type==="foundational"?"Foundational":node.year}</Pill>}
          {node.custom && <Pill color="#A78BFA">Custom</Pill>}
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#2C2416", cursor:"pointer", fontSize:"20px", lineHeight:1, flexShrink:0 }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
        <div style={{ fontSize:"15px", color:"#2C2416", lineHeight:"1.4", marginBottom:"8px", fontWeight:500 }}>{node.title}</div>
        <div style={{ fontSize:"11px", color:"#3D2B1A", fontStyle:"italic", marginBottom:"3px" }}>{node.source}</div>
        <div style={{ fontSize:"10px", color:"#2C2416", marginBottom:"12px" }}>{node.published} · {node.readingMinutes} min</div>
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
          {node.keywords.map((kw,i) => <span key={i} style={{ fontSize:"10px", color:c, background:c+"14", border:"1px solid "+c+"30", padding:"2px 7px", borderRadius:"2px" }}>#{kw}</span>)}
        </div>

        {/* Notes preview */}
        {hasNote && (
          <div style={{ background:"rgba(184,134,11,0.06)", border:"1px solid rgba(184,134,11,0.18)", borderRadius:"3px", padding:"10px 12px", marginBottom:"12px" }}>
            {noteData.argument && <div style={{ fontSize:"11px", color:"#2C2416", lineHeight:1.5, marginBottom: noteData.thoughts?"8px":0 }}><span style={{ fontSize:"9px", color:"#8B6508", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"3px" }}>Argument</span>{noteData.argument.slice(0,120)}{noteData.argument.length>120?"…":""}</div>}
            {noteData.thoughts && <div style={{ fontSize:"11px", color:"#2C2416", lineHeight:1.5 }}><span style={{ fontSize:"9px", color:"#8B6508", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"3px" }}>My thoughts</span>{noteData.thoughts.slice(0,120)}{noteData.thoughts.length>120?"…":""}</div>}
          </div>
        )}

        {connectedTitles.length > 0 && (
          <div>
            <div style={{ fontSize:"9px", color:"#6B5035", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"7px" }}>
              Connected via shared keywords — <span style={{ fontStyle:"italic" }}>click to navigate</span>
            </div>
            {connectedTitles.slice(0,8).map((ct,i) => {
              const cc = COLOR[ct.theme] || "#6B5035";
              return (
                <button key={i} onClick={() => onNavigate && onNavigate(ct.id)}
                  style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderLeft:"2px solid "+cc+"55", padding:"5px 0 5px 9px", marginBottom:"4px", cursor:"pointer", borderRadius:"0 3px 3px 0", transition:"background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = cc+"10"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize:"9px", color:cc, marginBottom:"2px", letterSpacing:"0.04em" }}>
                    #{ct.keywords.join(" · #")}
                  </div>
                  <div style={{ fontSize:"11px", color:"#2C2416", lineHeight:1.4, ...F }}>
                    {ct.title.length>52 ? ct.title.slice(0,52)+"…" : ct.title}
                  </div>
                  <div style={{ fontSize:"10px", color:"#6B5035", fontStyle:"italic", marginTop:"1px" }}>
                    {ct.source}
                  </div>
                </button>
              );
            })}
            {connectedTitles.length>8 && (
              <div style={{ fontSize:"10px", color:"#6B5035", paddingLeft:"9px", marginTop:"4px", fontStyle:"italic" }}>
                +{connectedTitles.length-8} more connections
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(60,40,20,0.32)", display:"flex", gap:"5px", flexWrap:"wrap" }}>
        <a href={node.url} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", padding:"7px 4px", background:"transparent", border:"1px solid "+c, color:c, borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"none", ...F }}>Read ↗</a>
        <button onClick={() => onOpenNote(node)} style={{ flex:1, padding:"7px 4px", background:hasNote?"rgba(232,197,71,0.1)":"transparent", border:hasNote?"1px solid rgba(232,197,71,0.35)":"1px solid rgba(60,40,20,0.22)", color:hasNote?"#8B6508":"#3D2B1A", borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", ...F }}>
          {hasNote?"✎ Note":"Note"}
        </button>
        <button onClick={() => onToggleRead(node.url)} style={{ flex:1, padding:"7px 4px", background:isRead?"rgba(52,211,153,0.1)":"transparent", border:isRead?"1px solid rgba(52,211,153,0.35)":"1px solid rgba(60,40,20,0.22)", color:isRead?"#34D399":"#3D2B1A", borderRadius:"3px", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", ...F }}>
          {isRead?"✓ Read":"To Read"}
        </button>
      </div>
    </div>
  );
}

// Compute inter-theme connection counts — used to position bubbles smartly
function interThemeWeights(items, links) {
  const itemTheme = Object.fromEntries(items.map(n => [n.id, n.theme]));
  const w = {};
  THEMES.forEach(a => THEMES.forEach(b => { w[a.name+"||"+b.name] = 0; }));
  links.forEach(l => {
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    const st = itemTheme[sid], tt = itemTheme[tid];
    if(st && tt && st !== tt) {
      const key = [st,tt].sort().join("||");
      w[key] = (w[key]||0) + 1;
    }
  });
  return w;
}

// Run a tiny synchronous force layout to place bubbles by connection density
function computeBubblePositions(items, links, W, H) {
  const weights = interThemeWeights(items, links);
  // seed positions evenly, then let attraction pull related themes together
  const N = THEMES.length;
  const outerR = Math.min(W, H) * 0.34;
  const pos = {};
  THEMES.forEach((t, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    pos[t.name] = { x: W/2 + outerR * Math.cos(a), y: H/2 + outerR * Math.sin(a) };
  });

  // 120 iterations of force-directed bubble placement
  for(let iter = 0; iter < 120; iter++) {
    const alpha = 1 - iter / 120;
    const forces = {};
    THEMES.forEach(t => { forces[t.name] = {x:0, y:0}; });

    // Attraction between theme pairs proportional to shared keyword connections
    THEMES.forEach((a, i) => {
      THEMES.forEach((b, j) => {
        if(i >= j) return;
        const key = [a.name,b.name].sort().join("||");
        const wt = weights[key] || 0;
        if(wt === 0) return;
        const dx = pos[b.name].x - pos[a.name].x;
        const dy = pos[b.name].y - pos[a.name].y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const str = wt * 0.002 * alpha;
        forces[a.name].x += dx/dist * str;
        forces[a.name].y += dy/dist * str;
        forces[b.name].x -= dx/dist * str;
        forces[b.name].y -= dy/dist * str;
      });
    });

    // Repulsion between all bubble pairs (keep them from collapsing)
    THEMES.forEach((a, i) => {
      THEMES.forEach((b, j) => {
        if(i >= j) return;
        const dx = pos[b.name].x - pos[a.name].x;
        const dy = pos[b.name].y - pos[a.name].y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const minDist = 190;
        if(dist < minDist) {
          const push = (minDist - dist) / minDist * 0.4 * alpha;
          forces[a.name].x -= dx/dist * push;
          forces[a.name].y -= dy/dist * push;
          forces[b.name].x += dx/dist * push;
          forces[b.name].y += dy/dist * push;
        }
      });
    });

    // Pull all back toward canvas center
    THEMES.forEach(t => {
      forces[t.name].x += (W/2 - pos[t.name].x) * 0.01 * alpha;
      forces[t.name].y += (H/2 - pos[t.name].y) * 0.01 * alpha;
    });

    THEMES.forEach(t => {
      pos[t.name].x += forces[t.name].x;
      pos[t.name].y += forces[t.name].y;
      // clamp to canvas
      pos[t.name].x = Math.max(120, Math.min(W-120, pos[t.name].x));
      pos[t.name].y = Math.max(100, Math.min(H-100, pos[t.name].y));
    });
  }
  return pos;
}

function GardenView({ pool, readItems, onToggleRead, notes, onSaveNote }) {
  const svgRef     = useRef(null);
  const simRef     = useRef(null);
  const linksRef   = useRef([]);
  const nodeSelRef = useRef(null);
  const linkSelRef = useRef(null);
  const readRef    = useRef(readItems);
  const zoomRef    = useRef(null);   // stores d3 zoom behaviour for programmatic navigation
  const nodesRef   = useRef([]);     // stores live node positions

  const [selected,  setSelected]  = useState(null);
  const [dimTheme,  setDimTheme]  = useState(null);
  const [ready,     setReady]     = useState(false);
  const [tooltip,   setTooltip]   = useState(null);
  const [noteItem,  setNoteItem]  = useState(null);

  // Pan + zoom to a node by id, then open its sidebar
  const navigateToNode = useCallback((nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if(!node || !svgRef.current || !zoomRef.current) return;
    const W = svgRef.current.clientWidth  || window.innerWidth;
    const H = svgRef.current.clientHeight || window.innerHeight - 88;
    const scale = 2.0;
    const tx = W/2 - scale * node.x;
    const ty = H/2 - scale * node.y;
    d3.select(svgRef.current)
      .transition().duration(550).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    setSelected({...node});
  }, []);

  // Keep readRef in sync without triggering sim rebuild
  useEffect(() => { readRef.current = readItems; }, [readItems]);

  const connectedTitles = useMemo(() => {
    if(!selected) return [];
    const nodeMap = Object.fromEntries(pool.map(n => [n.id, n]));
    return linksRef.current
      .filter(l => l.source?.id === selected.id || l.target?.id === selected.id)
      .map(l => {
        const oid = l.source?.id === selected.id ? l.target?.id : l.source?.id;
        const o = nodeMap[oid];
        return o ? {...o, keywords: l.keywords} : null;
      })
      .filter(Boolean)
      .sort((a,b) => b.keywords.length - a.keywords.length);
  }, [selected, pool]);

  useEffect(() => { setTimeout(() => setReady(true), 120); }, []);

  // ── Main D3 effect — only reruns when pool changes, NOT on readItems ──
  useEffect(() => {
    if(!svgRef.current || !ready) return;

    const W = svgRef.current.clientWidth  || window.innerWidth;
    const H = svgRef.current.clientHeight || (window.innerHeight - 88);
    const items = pool;
    const links = buildLinks(items);
    linksRef.current = links;

    // Bubble radii — scale with node count, grows properly with custom items
    const themeCount = {};
    THEMES.forEach(t => { themeCount[t.name] = 0; });
    items.forEach(n => { if(themeCount[n.theme] !== undefined) themeCount[n.theme]++; });
    const bubbleR = {};
    THEMES.forEach(t => { bubbleR[t.name] = Math.max(52, Math.sqrt(themeCount[t.name] || 0) * 23); });

    // Smart bubble positions from inter-theme connection density
    const rawPos = computeBubblePositions(items, links, W, H);
    // Shift bubble center slightly inward so label above fits
    const bubblePos = {};
    THEMES.forEach(t => {
      bubblePos[t.name] = { cx: rawPos[t.name].x, cy: rawPos[t.name].y };
    });

    // Node initial positions scattered inside their bubble
    const nodes = items.map(item => {
      const bp = bubblePos[item.theme];
      const a  = Math.random() * 2 * Math.PI;
      const r  = Math.random() * 18;
      return { ...item, x: bp.cx + r * Math.cos(a), y: bp.cy + r * Math.sin(a) };
    });

    // ── Build SVG ──
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);

    // Defs
    const defs = svg.append("defs");
    THEMES.forEach(t => {
      const grad = defs.append("radialGradient")
        .attr("id", "rbg_" + t.name.replace(/\s/g,"_"))
        .attr("cx","50%").attr("cy","50%").attr("r","50%");
      grad.append("stop").attr("offset","0%").attr("stop-color", t.color).attr("stop-opacity", 0.1);
      grad.append("stop").attr("offset","100%").attr("stop-color", t.color).attr("stop-opacity", 0.02);
    });
    const gf = defs.append("filter").attr("id","glow3").attr("x","-50%").attr("y","-50%").attr("width","200%").attr("height","200%");
    gf.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const fm = gf.append("feMerge");
    fm.append("feMergeNode").attr("in","blur");
    fm.append("feMergeNode").attr("in","SourceGraphic");

    const zoom = d3.zoom().scaleExtent([0.15, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
      const k = e.transform.k;
      labelSel.attr("opacity", k >= 1.4 ? Math.min(1, (k-1.4)*2) : 0);
    });
    zoomRef.current = zoom;
    svg.call(zoom);
    const g = svg.append("g");

    // Bubble backgrounds
    const bg = g.append("g");
    THEMES.forEach(t => {
      const bp = bubblePos[t.name], r = bubbleR[t.name];
      bg.append("circle")
        .attr("cx", bp.cx).attr("cy", bp.cy).attr("r", r)
        .attr("fill", "url(#rbg_" + t.name.replace(/\s/g,"_") + ")")
        .attr("stroke", t.color).attr("stroke-opacity", 0.18)
        .attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");
      bg.append("text")
        .attr("x", bp.cx).attr("y", bp.cy - r - 8)
        .attr("text-anchor","middle").attr("font-size","10px")
        .attr("font-family","'Palatino Linotype',Palatino,serif")
        .attr("fill", t.color).attr("opacity", 0.75)
        .attr("letter-spacing","0.08em").text(t.name.toUpperCase());
    });

    // Draw ALL cross-bubble links (intra-bubble are too dense visually but all
    // connections show on hover via the full links array)
    const crossLinks = links.filter(l => {
      const s = items.find(n => n.id === (typeof l.source==="object"?l.source.id:l.source));
      const t = items.find(n => n.id === (typeof l.target==="object"?l.target.id:l.target));
      return s && t && s.theme !== t.theme;
    });

    const linkSel = g.append("g")
      .selectAll("line").data(crossLinks).enter().append("line")
      .attr("stroke","rgba(60,40,20,0.1)").attr("stroke-width",0.8)
      .style("pointer-events","none");
    linkSelRef.current = linkSel;

    const NR = 5;

    // Compute degree for node sizing
    const degree = {};
    items.forEach(n => { degree[n.id] = 0; });
    links.forEach(l => {
      const sid = typeof l.source==="object" ? l.source.id : l.source;
      const tid = typeof l.target==="object" ? l.target.id : l.target;
      degree[sid] = (degree[sid]||0) + 1;
      degree[tid] = (degree[tid]||0) + 1;
    });
    nodes.forEach(n => { n.degree = degree[n.id] || 0; });
    const maxDeg = d3.max(nodes, d => d.degree) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxDeg]).range([NR, NR+5]);

    const nodeSel = g.append("g")
      .selectAll("circle").data(nodes).enter().append("circle")
      .attr("r", d => rScale(d.degree))
      .attr("fill", d => COLOR[d.theme])
      .attr("fill-opacity", d => readRef.current.has(d.url) ? 0.2 : 0.82)
      .attr("stroke", d => COLOR[d.theme]).attr("stroke-opacity", 0.5).attr("stroke-width", 1)
      .style("cursor","pointer")
      .call(d3.drag()
        .on("start", (e,d) => { if(!e.active && simRef.current) simRef.current.alphaTarget(0.2).restart(); d.fx=d.x; d.fy=d.y; })
        .on("drag",  (e,d) => { d.fx=e.x; d.fy=e.y; })
        .on("end",   (e,d) => { if(!e.active && simRef.current) simRef.current.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on("mouseenter", function(e, d) {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip({ x: e.clientX-rect.left, y: e.clientY-rect.top-14, text: d.title.length>60 ? d.title.slice(0,60)+"…" : d.title });
        d3.select(this).attr("r", rScale(d.degree)+3).attr("filter","url(#glow3)").attr("fill-opacity",1);
        // Highlight ALL connections (intra + inter bubble)
        const connIds = new Set(
          links
            .filter(l => l.source?.id===d.id || l.target?.id===d.id)
            .flatMap(l => [l.source?.id, l.target?.id])
        );
        nodeSel.attr("fill-opacity", n => n.id===d.id ? 1 : connIds.has(n.id) ? 0.9 : 0.08);
        linkSel
          .attr("stroke", l => (l.source?.id===d.id||l.target?.id===d.id) ? COLOR[d.theme]+"dd" : "rgba(60,40,20,0.02)")
          .attr("stroke-width", l => (l.source?.id===d.id||l.target?.id===d.id) ? 2 : 0.3);
      })
      .on("mousemove", function(e) {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip(t => t ? {...t, x:e.clientX-rect.left, y:e.clientY-rect.top-14} : t);
      })
      .on("mouseleave", function(e, d) {
        setTooltip(null);
        d3.select(this).attr("r", rScale(d.degree)).attr("filter",null);
        resetOp();
      })
      .on("click", (e,d) => { e.stopPropagation(); setSelected(d); });

    nodeSelRef.current = nodeSel;

    // Labels — hidden until zoom >= 1.4
    const highDeg = nodes.filter(d => d.degree >= 5);
    const labelSel = g.append("g")
      .selectAll("text").data(highDeg).enter().append("text")
      .text(d => d.title.split(":")[0].split("—")[0].trim().slice(0, 26))
      .attr("font-size","7px")
      .attr("font-family","'Palatino Linotype',Palatino,serif")
      .attr("fill","#3A2518")
      .attr("text-anchor","middle")
      .attr("dy", d => rScale(d.degree) + 9)
      .attr("opacity", 0)
      .style("pointer-events","none")
      .style("user-select","none");

    svg.on("click", () => setSelected(null));

    function resetOp() {
      nodeSel.attr("fill-opacity", d => readRef.current.has(d.url) ? 0.2 : 0.82);
      linkSel.attr("stroke","rgba(60,40,20,0.1)").attr("stroke-width",0.8);
    }

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(75).strength(0.03))
      .force("charge", d3.forceManyBody().strength(-20))
      .force("collision", d3.forceCollide(d => rScale(d.degree) + 2))
      .force("bubble", () => {
        nodes.forEach(d => {
          const bp = bubblePos[d.theme], r = bubbleR[d.theme];
          const dx = d.x - bp.cx, dy = d.y - bp.cy;
          const dist = Math.sqrt(dx*dx+dy*dy) || 0.01;
          // Gentle pull toward bubble center
          d.vx -= dx * 0.07;
          d.vy -= dy * 0.07;
          // Hard wall at bubble edge
          const maxR = r - rScale(d.degree) - 3;
          if(dist > maxR) {
            const over = dist - maxR;
            d.vx -= (dx/dist) * over * 0.5;
            d.vy -= (dy/dist) * over * 0.5;
          }
        });
      })
      .alphaDecay(0.013)
      .on("tick", () => {
        linkSel.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
        nodeSel.attr("cx",d=>d.x).attr("cy",d=>d.y);
        labelSel.attr("x",d=>d.x).attr("y",d=>d.y);
      });

    simRef.current = sim;
    linksRef.current = links;
    nodesRef.current = nodes; // keep live positions for navigation

    return () => { sim.stop(); };
  }, [ready, pool]); // ← readItems intentionally NOT here

  // ── Opacity-only update when readItems changes — no sim restart ──
  useEffect(() => {
    if(!nodeSelRef.current) return;
    nodeSelRef.current.attr("fill-opacity", d => readItems.has(d.url) ? 0.2 : 0.82);
  }, [readItems]);

  // ── Theme filter ──
  useEffect(() => {
    if(!nodeSelRef.current || !linkSelRef.current) return;
    if(dimTheme) {
      nodeSelRef.current.attr("fill-opacity", d => d.theme===dimTheme ? (readItems.has(d.url)?0.28:0.92) : 0.05);
      linkSelRef.current
        .attr("stroke", l => {
          const st = l.source?.theme, tt = l.target?.theme;
          return (st===dimTheme || tt===dimTheme) ? COLOR[dimTheme]+"99" : "rgba(255,255,255,0.01)";
        })
        .attr("stroke-width", l => {
          const st = l.source?.theme, tt = l.target?.theme;
          return (st===dimTheme || tt===dimTheme) ? 1.5 : 0.3;
        });
    } else {
      nodeSelRef.current.attr("fill-opacity", d => readItems.has(d.url) ? 0.2 : 0.82);
      linkSelRef.current.attr("stroke","rgba(60,40,20,0.1)").attr("stroke-width",0.8);
    }
  }, [dimTheme, readItems]);

  const sideOpen = !!selected;
  return (
    <div style={{ position:"relative", width:"100%", height:"calc(100vh - 88px)" }}>
      {/* Theme filter pills */}
      <div style={{ position:"absolute", top:"10px", left:"10px", zIndex:10, display:"flex", flexDirection:"column", gap:"3px" }}>
        {THEMES.map(t => (
          <button key={t.name} onClick={() => setDimTheme(d => d===t.name ? null : t.name)}
            style={{ ...F, display:"flex", alignItems:"center", gap:"6px", background:dimTheme===t.name?t.color+"22":"rgba(228,220,205,0.97)", border:"1px solid "+(dimTheme===t.name?t.color:"rgba(60,40,20,0.28)"), borderRadius:"3px", padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.color, flexShrink:0 }} />
            <span style={{ fontSize:"9px", letterSpacing:"0.07em", textTransform:"uppercase", color:dimTheme===t.name?t.color:"#3D2B1A", whiteSpace:"nowrap" }}>{t.name}</span>
          </button>
        ))}
        {dimTheme && (
          <button onClick={() => setDimTheme(null)} style={{ ...F, background:"rgba(228,220,205,0.97)", border:"1px solid rgba(60,40,20,0.28)", borderRadius:"3px", padding:"3px 8px", cursor:"pointer", color:"#6B5035", fontSize:"9px", letterSpacing:"0.07em", textTransform:"uppercase" }}>Clear</button>
        )}
      </div>

      <svg ref={svgRef} style={{ position:"absolute", inset:0, width:sideOpen?"calc(100% - 290px)":"100%", height:"100%", background:"transparent" }} />

      {tooltip && (
        <div style={{ position:"absolute", left:tooltip.x, top:tooltip.y, transform:"translate(-50%,-100%)", background:"rgba(235,228,215,0.99)", border:"1px solid rgba(60,40,20,0.25)", borderRadius:"3px", padding:"5px 10px", fontSize:"11px", color:"#2C2416", pointerEvents:"none", zIndex:50, maxWidth:"260px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", ...F }}>
          {tooltip.text}
        </div>
      )}

      {sideOpen && <GardenSidebar node={selected} onClose={() => setSelected(null)} readItems={readItems} onToggleRead={onToggleRead} notes={notes} onOpenNote={setNoteItem} connectedTitles={connectedTitles} onNavigate={navigateToNode} />}
      {noteItem  && <NotesModal item={noteItem} notes={notes} onSave={onSaveNote} onClose={() => setNoteItem(null)} />}
      {!ready    && <div style={{ position:"absolute",inset:0,background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99 }}><span style={{ ...F, fontSize:"11px",color:"#6B5035",letterSpacing:"0.15em",textTransform:"uppercase" }}>Growing the garden…</span></div>}
    </div>
  );
}


// ─── Stats view ───────────────────────────────────────────────────────────────

function StatBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{ flex:1, height:"4px", background:"rgba(60,40,20,0.32)", borderRadius:"2px", overflow:"hidden" }}>
        <div style={{ height:"100%", width: pct+"%", background: color, borderRadius:"2px", transition:"width 0.6s ease" }} />
      </div>
      <span style={{ fontSize:"10px", color:"#2C2416", width:"36px", textAlign:"right" }}>{value}/{max}</span>
    </div>
  );
}

function StatsView({ pool, readItems, notes }) {
  const essays      = pool.filter(x => x.type === "essay");
  const papers      = pool.filter(x => x.type !== "essay");
  const foundational= pool.filter(x => x.type === "foundational");
  const recent      = pool.filter(x => x.type === "recent");

  const readEssays  = essays.filter(x => readItems.has(x.url));
  const readPapers  = papers.filter(x => readItems.has(x.url));
  const readFound   = foundational.filter(x => readItems.has(x.url));
  const readRecent  = recent.filter(x => readItems.has(x.url));

  const totalRead   = readItems.size;
  const totalMins   = pool.filter(x => readItems.has(x.url)).reduce((s,x) => s + x.readingMinutes, 0);
  const totalNotes  = Object.keys(notes).length;

  // Per-theme breakdown
  const themeStats  = THEMES.map(t => {
    const all  = pool.filter(x => x.theme === t.name);
    const done = all.filter(x => readItems.has(x.url));
    const noted= all.filter(x => notes[x.url]);
    return { ...t, total: all.length, read: done.length, noted: noted.length };
  }).sort((a, b) => b.read - a.read);

  const maxThemeTotal = Math.max(...themeStats.map(t => t.total));

  // Notes list — most recent shown by order of pool
  const notedItems = pool.filter(x => notes[x.url]).slice().reverse().slice(0, 12);

  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"32px 24px 80px" }}>

      {/* Hero numbers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:"10px", marginBottom:"36px" }}>
        {[
          { label:"Total read",    value: totalRead,  sub: `of ${pool.length}`,   color:"#34D399" },
          { label:"Essays read",   value: readEssays.length, sub:`of ${essays.length}`, color:"#8B6508" },
          { label:"Papers read",   value: readPapers.length, sub:`of ${papers.length}`, color:"#60A5FA" },
          { label:"Time invested", value: timeStr,    sub:"reading time",          color:"#A78BFA" },
          { label:"Notes written", value: totalNotes, sub:`across ${pool.length} items`, color:"#F97316" },
        ].map(s => (
          <div key={s.label} style={{ background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.32)", borderTop:"2px solid "+s.color, borderRadius:"3px", padding:"14px 14px 12px" }}>
            <div style={{ fontSize:"22px", color: s.color, fontWeight:400, lineHeight:1, marginBottom:"5px" }}>{s.value}</div>
            <div style={{ fontSize:"10px", color:"#3D2B1A", letterSpacing:"0.05em" }}>{s.label}</div>
            <div style={{ fontSize:"10px", color:"#2C2416", marginTop:"2px" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Academic breakdown */}
      <div style={{ marginBottom:"36px" }}>
        <div style={{ fontSize:"10px", color:"#6B5035", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>Academic breakdown</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[
            { label:"Foundational papers", read: readFound.length, total: foundational.length, color:"#F97316" },
            { label:"Recent papers",       read: readRecent.length, total: recent.length,       color:"#60A5FA" },
          ].map(row => (
            <div key={row.label}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                <span style={{ fontSize:"12px", color:"#2C2416" }}>{row.label}</span>
                <span style={{ fontSize:"11px", color: row.read===row.total && row.total>0 ? "#34D399":"#3D2B1A" }}>
                  {row.read===row.total && row.total>0 ? "✓ Complete" : `${Math.round(row.read/row.total*100)||0}%`}
                </span>
              </div>
              <StatBar value={row.read} max={row.total} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Per-theme breakdown */}
      <div style={{ marginBottom:"36px" }}>
        <div style={{ fontSize:"10px", color:"#3D2B1A", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>Progress by theme</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {themeStats.map(t => (
            <div key={t.name}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"5px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.color }} />
                  <span style={{ fontSize:"12px", color:"#2C2416" }}>{t.name}</span>
                  {t.noted > 0 && <span style={{ fontSize:"9px", color:"#8B6508", background:"rgba(184,134,11,0.08)", border:"1px solid rgba(184,134,11,0.2)", borderRadius:"2px", padding:"1px 5px" }}>✎ {t.noted} note{t.noted>1?"s":""}</span>}
                </div>
                <span style={{ fontSize:"10px", color: t.read===t.total ? "#1A7A5E":"#6B5035" }}>
                  {t.read}/{t.total}
                </span>
              </div>
              <StatBar value={t.read} max={t.total} color={t.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Notes list */}
      {notedItems.length > 0 && (
        <div>
          <div style={{ fontSize:"10px", color:"#3D2B1A", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>
            Your notes ({totalNotes})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
            {notedItems.map(item => {
              const n = notes[item.url];
              const c = COLOR[item.theme] || "#6B5035";
              return (
                <div key={item.url} style={{ background:"rgba(60,40,20,0.07)", border:"1px solid rgba(60,40,20,0.24)", borderLeft:"3px solid "+c, borderRadius:"3px", padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"6px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"1px 6px", borderRadius:"2px", background:c+"22", color:c, fontWeight:600 }}>{item.theme}</span>
                    <span style={{ fontSize:"10px", color:"#2C2416", fontStyle:"italic" }}>{item.source} · {item.published}</span>
                  </div>
                  <div style={{ fontSize:"13px", color:"#2C2416", marginBottom:"10px", lineHeight:1.4, fontWeight:500 }}>{item.title}</div>
                  {n.argument && (
                    <div style={{ marginBottom: n.thoughts ? "8px" : 0 }}>
                      <div style={{ fontSize:"9px", color:"#8B6508", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>Argument</div>
                      <div style={{ fontSize:"12px", color:"#3D2B1A", lineHeight:1.6 }}>{n.argument}</div>
                    </div>
                  )}
                  {n.thoughts && (
                    <div>
                      <div style={{ fontSize:"9px", color:"#60A5FA", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>My thoughts</div>
                      <div style={{ fontSize:"12px", color:"#6B5035", lineHeight:1.6 }}>{n.thoughts}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalRead === 0 && (
        <div style={{ marginTop:"60px", textAlign:"center" }}>
          <div style={{ fontSize:"13px", color:"#2C2416", fontStyle:"italic" }}>No items marked as read yet.</div>
          <div style={{ fontSize:"11px", color:"#3A2518", marginTop:"6px" }}>Head to the Dispatch tab and start reading.</div>
        </div>
      )}
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────

const NAV = { ...F, background:"transparent", border:"1px solid rgba(60,40,20,0.32)", color:"#6B5035", width:"28px", height:"28px", borderRadius:"3px", cursor:"pointer", fontSize:"14px", display:"inline-flex", alignItems:"center", justifyContent:"center" };

export default function App() {
  const [tab, setTab]             = useState("dispatch");
  const [customItems, setCustomItems] = useState([]);
  const [readItems, setReadItems] = useState(new Set());
  const [notes, setNotes]         = useState({});
  const [loaded, setLoaded]       = useState(false);

  // Load persisted state
  useEffect(() => {
    Promise.all([
      Promise.resolve({ value: localStorage.getItem("read_items") }),
      Promise.resolve({ value: localStorage.getItem("notes") }),
      Promise.resolve({ value: localStorage.getItem("custom_items") }),
    ]).then(([r,n,c]) => {
      if(r?.value) setReadItems(new Set(JSON.parse(r.value)));
      if(n?.value) setNotes(JSON.parse(n.value));
      if(c?.value) setCustomItems(JSON.parse(c.value));
      setLoaded(true);
    });
  }, []);

  const pool = useMemo(() => [...BUILTIN, ...customItems], [customItems]);

  const toggleRead = useCallback(key => {
    setReadItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      Promise.resolve(localStorage.setItem("read_items", JSON.stringify([...next])));
      return next;
    });
  }, []);

  const saveNote = useCallback((url, data) => {
    setNotes(prev => {
      const next = {...prev};
      if(data === null) delete next[url]; else next[url] = data;
      Promise.resolve(localStorage.setItem("notes", JSON.stringify(next)));
      return next;
    });
  }, []);

  const addItem = useCallback(item => {
    setCustomItems(prev => {
      const next = [...prev, item];
      Promise.resolve(localStorage.setItem("custom_items", JSON.stringify(next)));
      return next;
    });
  }, []);

  const deleteItem = useCallback(id => {
    setCustomItems(prev => {
      const next = prev.filter(x => x.id !== id);
      Promise.resolve(localStorage.setItem("custom_items", JSON.stringify(next)));
      return next;
    });
  }, []);

  const totalNotes = Object.keys(notes).length;
  const totalRead  = readItems.size;

  if(!loaded) return <div style={{ ...F, height:"100vh", background:"#F5F0E8", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:"11px", color:"#6B5035", letterSpacing:"0.15em", textTransform:"uppercase" }}>Loading…</span></div>;

  return (
    <div style={{ height:"100vh", background:"#F5F0E8", color:"#2C2416", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ height:"44px", background:"rgba(228,220,205,0.99)", borderBottom:"1px solid rgba(60,40,20,0.25)", display:"flex", alignItems:"center", paddingLeft:"18px", paddingRight:"18px", flexShrink:0, gap:"16px", backdropFilter:"blur(4px)", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#8B6508" }} />
          <span style={{ ...F, fontSize:"12px", color:"#2C2416", letterSpacing:"0.12em", textTransform:"uppercase" }}>The Dispatch</span>
        </div>
        <div style={{ height:"100%", borderLeft:"1px solid rgba(60,40,20,0.32)", marginLeft:"4px" }} />
        <TabBar active={tab} onChange={setTab} />
        <div style={{ marginLeft:"auto", display:"flex", gap:"14px", alignItems:"center" }}>
          {totalRead > 0  && <span style={{ fontSize:"10px", color:"#6B5035" }}>{totalRead} read</span>}
          {totalNotes > 0 && <span style={{ fontSize:"10px", color:"#6B5035" }}>{totalNotes} notes</span>}
          {customItems.length > 0 && <span style={{ fontSize:"10px", color:"#6340A888" }}>+{customItems.length} custom</span>}
        </div>
      </div>

      {/* Subheader for garden */}
      {tab === "garden" && (
        <div style={{ height:"44px", background:"rgba(228,220,205,0.97)", borderBottom:"1px solid rgba(60,40,20,0.28)", display:"flex", alignItems:"center", padding:"0 18px", flexShrink:0 }}>
          <span style={{ ...F, fontSize:"10px", color:"#6B5035", fontStyle:"italic" }}>{pool.length} items · bubbles positioned by keyword density · zoom in for labels · scroll to zoom · drag to pan</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex:1, overflowY: tab==="garden"?"hidden":"auto", overflowX:"hidden", position:"relative" }}>
        {tab === "dispatch" && <DispatchView pool={pool} readItems={readItems} onToggleRead={toggleRead} notes={notes} onSaveNote={saveNote} />}
        {tab === "garden"   && <GardenView   pool={pool} readItems={readItems} onToggleRead={toggleRead} notes={notes} onSaveNote={saveNote} />}
        {tab === "stats"    && <StatsView    pool={pool} readItems={readItems} notes={notes} />}
        {tab === "add"      && <AddSourceView pool={pool} onAdd={addItem} onDelete={deleteItem} />}
      </div>
    </div>
  );
}

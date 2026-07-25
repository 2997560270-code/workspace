# Product Discovery Assessment Item Bank Research

Date: 2026-07-22

## Question

How can Product Drill create training and assessment tasks before it has user data, then improve task quality through a governed data flywheel?

## Findings

### Content can precede users; calibration cannot

An initial task bank can be grounded in job analysis, critical incidents, subject-matter expert review, and behaviorally anchored scoring. Without representative response data, it cannot support percentiles, comparable scaled scores, hiring cutoffs, or claims that scores predict job performance.

### Start from claims and evidence

ETS evidence-centered design separates the proficiency claim, the observable evidence needed to support it, and the task conditions that elicit that evidence. Product Drill should use this order instead of generating prompts first.

For each product discovery judgment claim, record:

- triggering job conditions;
- effective and ineffective behavior;
- observable decision evidence;
- plausible alternative paths;
- causal consequences;
- transfer conditions.

### Build tasks from job-related critical incidents

OPM treats job analysis as the foundation of assessment and selection. Its guidance for situational judgment tests and structured interviews recommends collecting effective and ineffective critical incidents from job experts, independently checking their competency linkage, developing behaviorally anchored responses, piloting with target users, and documenting the process.

AI may draft surface variants within an approved causal scenario world. It must not establish the world truth, competency linkage, scoring anchors, or employment cutoff by itself.

### Keep separate pools

- **Training pool**: feedback and repeated variants are allowed.
- **Pilot pool**: gathers item evidence without contributing to an external score.
- **Assessment pool**: unassisted, versioned, and exposure-controlled.
- **Anchor pool**: stable content used to link results across forms and versions.

ETS and OECD guidance shows that comparable scores across forms require explicit linking or equating assumptions, representative anchors, documented calibration, and checks that item properties remain stable.

### Govern the task lifecycle

Use the minimum lifecycle that preserves evidence:

```text
draft -> expert approved -> pilot -> calibrated -> operational
                                      |              |
                                      +-> revise     +-> monitor or retire
```

Monitor task difficulty, discrimination, scorer agreement, repeated-score consistency, transfer prediction, job-performance relationships, group fairness, exposure, and information gain.

New AI-generated variants enter the pilot pool. They do not become operational because they look plausible or because a model approves them.

### Delay adaptive assessment

Adaptive training can choose challenges from the judgment evidence graph. Standardized assessment should initially use fixed or controlled multistage forms. Item-level adaptive testing depends on calibrated item parameters, stable item behavior, sufficient coverage across difficulty, and checks for differential item functioning.

### Employment use requires a higher gate

SIOP states that AI-based hiring assessments should be job-related, consistent, predictive of relevant outcomes, fair, and documented for audit. AERA, APA, and NCME standards treat validity as evidence for a specified score interpretation and use, not as a property a test automatically possesses. EEOC guidance requires employment selection procedures to be job-related and appropriate for their intended use, with attention to adverse impact.

Product Drill should therefore publish diagnostic reports first. It should not market an employment metric until the intended use has sufficient validity and fairness evidence.

## Data Flywheel

```text
task conditions
-> decision events and confidence
-> independent or assisted evidence
-> expert and model scoring
-> consequences and transfer outcomes
-> item-quality analysis
-> retain, revise, replace, or retire
```

The defensible asset is not the number of generated questions. It is the calibrated relationship between task conditions, observed decisions, interventions, transfer evidence, and relevant external outcomes.

## Primary Sources

- [ETS: Evidence-Centered Design](https://www.ets.org/research/policy_research_reports/publications/chapter/2016/jwau.html)
- [ETS: Evidence-Centered Design for Learning](https://www.ets.org/research/policy_research_reports/publications/report/2011/imbu.html)
- [ETS Standards for Quality and Fairness](https://praxis.ets.org/on/demandware.static/-/Library-Sites-ets-praxisLibrary/default/dw0c7ee2d6/pdfs/standards-quality-fairness.pdf)
- [APA/AERA/NCME: Standards for Educational and Psychological Testing](https://www.apa.org/science/programs/testing/standards)
- [SIOP: Validation and Use of AI-Based Assessments for Employee Selection](https://www.siop.org/wp-content/uploads/2024/06/Considerations-and-Recommendations-for-the-Validation-and-Use-of-AI-Based-Assessments-for-Employee-Selection-January-2023.pdf)
- [OPM: Job Analysis](https://www.opm.gov/policy-data-oversight/assessment-and-selection/job-analysis/)
- [OPM: Situational Judgment Tests](https://www.opm.gov/policy-data-oversight/assessment-and-selection/other-assessment-methods/situational-judgment-tests/)
- [OPM: Structured Interview Guide](https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/guide.pdf)
- [OECD: Theoretical Considerations on PISA Scaling](https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/12/theoretical-considerations-on-scaling-methodology-in-pisa_47fb85ae/c224dbeb-en.pdf)
- [EEOC: Employment Tests and Selection Procedures](https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures)

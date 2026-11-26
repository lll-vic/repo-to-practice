export const englishRecipes = {
  ai: {
    name: 'AI evaluation',
    title: 'Evaluate an output on a small sample',
    steps: [
      'Pick a scenario where you can check the input against the output. If the project does not generate anything, use an excerpt as input and write a few sample outputs to audit.',
      'Create five examples, including at least one ambiguous or underspecified case. Label each output as supported, contradicted, or unverifiable.',
      'Compare two ways of producing the output using the same standard. Record the hardest example and why you labeled it that way.'
    ],
    checks: ['Produce a comparison table with at least five cases, each with a source link or excerpt.', 'Report results for both approaches and one limitation of the sample.'],
    question: 'Which output was hardest to judge? Would relabeling it change your comparison?'
  },
  product: {
    name: 'Product analysis',
    title: 'Walk through a core user flow',
    steps: [
      'Name a specific user and their task. Follow the shortest route described in the source. If you can only read the documentation, mark it as a documentation walkthrough.',
      'Record the entry point, key decisions, and what signals completion. Identify one step where a new user could hesitate or fail.',
      'Propose one change, sketch the before-and-after flow, and explain how you would test it.'
    ],
    checks: ['Produce a source-linked flow diagram or a three-to-five-step walkthrough.', 'Name an observed problem, a proposed change, and a measurable way to test it.'],
    question: 'Why did you prioritize that step? How would you tell whether your change reduced failures or just reduced clicks?'
  },
  testing: {
    name: 'Testing & debugging',
    title: 'Add a regression test for runnable behavior',
    steps: [
      'Pick a behavior with a clear input and output. Run the smallest example and record the command and environment.',
      'Choose an edge case. Write down the expected behavior and its basis, then turn it into a reproducible test.',
      'Temporarily break the behavior locally and confirm the test fails. Restore the original behavior and rerun it.'
    ],
    checks: ['Save the test or script and the output from the failing and passing runs.', 'Identify what the test covers and one edge case it leaves out.'],
    question: 'Would the test still pass if the implementation changed but the public behavior stayed the same? How could you check?'
  },
  architecture: {
    name: 'Architecture',
    title: 'Trace one complete request',
    steps: [
      'Pick a concrete input from a source and locate the entry point and how it is triggered.',
      'Follow a success case through to the result and record each data handoff. Use logs if you can run it and label inferences from reading the code.',
      'Sketch the path, one failure case, and what the caller would see.'
    ],
    checks: ['Keep links to the entry point and at least one later processing step.', 'Produce a diagram or trace that separates runtime observations from inferences.'],
    question: 'What would the caller see if an intermediate dependency timed out? What supports your answer?'
  },
  performance: {
    name: 'Performance',
    title: 'Measure a reproducible performance metric',
    steps: [
      'Pick one runnable step with a fixed environment and input. Decide whether to measure time or throughput.',
      'Record your command and input size. Run the baseline and one changed condition at least five times each.',
      'Compare medians and variation. Write down one factor that could affect the result.'
    ],
    checks: ['Keep the raw measurements and commands needed to reproduce them.', 'Report both medians and whether your evidence supports the claimed change.'],
    question: 'If the input grew tenfold, how would your measurement method and result change?'
  },
  general: {
    name: 'Custom goal',
    title: 'Verify one small scenario in the project',
    steps: [
      'Turn your goal into an observable outcome, then use the sources to find the smallest case that can produce it.',
      'Write down the steps and expected result. Record what actually happens in a run or a walkthrough.',
      'Change one input or assumption and try again. Explain which observation supports your judgment.'
    ],
    checks: ['Produce notes another person can use to repeat the exercise, with at least one source.', 'Describe the result, one limitation, and what you would check next.'],
    question: 'How do you know the observation supports your conclusion? What might change with a different input?'
  }
};

export const evaluationRecipe = {
  name: 'Focused evaluation',
  title: 'Compare two approaches against one fixed standard',
  steps: [
    'Choose one observable quality dimension from your goal and write a clear pass-or-fail rule.',
    'Use the same inputs for both approaches. Save their actual outputs and evidence from the original text or video.',
    'Score both with the same rule, summarize the difference, and note one limitation that could change your conclusion.'
  ],
  checks: [
    'Keep the test inputs and both actual outputs.',
    'Attach checkable evidence to every score.',
    'Report the comparison and one limitation.'
  ],
  question: 'Which rule would another evaluator be most likely to score differently?',
  training: {
    id: 'evaluation',
    title: 'Guided task-specific evaluation',
    intro: 'Turn your goal into a small, repeatable evaluation. Fix the inputs and rule, then record each actual result.',
    steps: [
      { title: 'Turn the goal into a rule', instruction: 'Choose one result to assess and state what visible observation passes or fails.', example: 'Replace “good quality” with an observable rule two people can apply independently.', output: 'One rule with a clear observable signal.' },
      { title: 'Prepare reusable inputs', instruction: 'Use the same inputs for both approaches. Include one ordinary case and one likely to produce an error or ambiguity.', example: 'Record exact inputs, settings, and date so you can reproduce the comparison.', output: 'At least two numbered test cases.' },
      { title: 'Record actual outputs and evidence', instruction: 'Keep each raw output. Mark evidence for every case without picking a winner first.', example: 'Cite the original line for factual claims and a timestamp for media.', output: 'Both outputs and a checkable evidence note for each input.' },
      { title: 'Score independently and compare', instruction: 'Apply the fixed rule to A and B, then calculate each total and the largest criterion-level difference.', example: 'Mark evidence you cannot check as “no evidence” instead of guessing a score.', output: 'A comparison table with individual scores and totals.' },
      { title: 'State the result and limitation', instruction: 'Use your strongest piece of evidence to explain the result. State one question this small test cannot answer.', example: 'Different inputs, random seeds, or evaluator disagreement may change the conclusion.', output: 'A result, one piece of evidence, and one next check.' }
    ]
  }
};

export const videoEvaluationRecipe = {
  id: 'video',
  name: 'Video generation evaluation',
  title: 'Compare two videos against the same prompt',
  steps: [
    'Start with the two built-in clips and their shared prompt, or use the same prompt to generate two clips of your own. Record settings that differ.',
    'Watch both clips and score prompt adherence, motion, visual consistency, and freedom from visible artifacts. Cite what you see and when it happens.',
    'Compare the scores, explain the biggest practical difference, and note what a single prompt cannot establish.',
    'Review the evaluation report and add it to your practice notes.'
  ],
  checks: [
    'Identify both clips and keep the shared prompt, source, and test conditions.',
    'Score both clips on all four criteria and cite timestamped observations for both, including any low or differing scores.',
    'Report each total out of 20, explain the most meaningful difference, and state a limitation of the comparison.'
  ],
  question: 'Which timestamp best supports your conclusion? What would you try next to see whether it holds for a different scene?',
  training: {
    id: 'video',
    title: 'Video generation evaluation',
    steps: [
      { title: 'Set up the comparison', instruction: 'Choose your clips. The built-in pair shares a fixed prompt and settings. For your own pair, paste the exact prompt into two generators and match duration, aspect ratio, and resolution as closely as possible.', output: 'Two clips with a shared prompt and a record of any settings that differ.' },
      { title: 'Watch and score both clips', instruction: 'Read the criteria, watch A and B all the way through, then give each clip four scores. Replay or scrub to check anything you missed.', output: 'Eight scores and timestamped observations that explain them.' },
      { title: 'Explain the difference', instruction: 'The page adds the four scores for each clip. Use the largest difference and your observations to write a finding. State one question this comparison cannot answer.', output: 'A finding backed by evidence and a limitation.' },
      { title: 'Review your report', instruction: 'Check that someone else could identify both clips, reproduce the comparison conditions, and understand your scores.', output: 'A report to add to your practice notes.' }
    ],
    rubric: [
      { id: 'instruction', help: 'Do the subject, action, setting, and camera movement match the prompt?' },
      { id: 'motion', help: 'Is the motion continuous? Look for sudden jumps or changes in the subject’s speed.' },
      { id: 'coherence', help: 'Do the subject’s shape, color, and surroundings stay consistent across frames?' },
      { id: 'artifacts', help: 'Look for flashes, extra objects, and render defects. Give a higher score when there are fewer defects.' }
    ]
  }
};

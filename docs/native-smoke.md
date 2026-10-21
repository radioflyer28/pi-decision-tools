# Separately authorized native smoke test

**Live execution has not been run.** Deterministic refusal tests are not a live-provider pass or a quality evaluation.

From the source checkout, `npm run smoke:native` builds and then refuses with `status:not_run` and `authorization_required`. Without the authorization flag, exact model and full finite budget, it does not load the host credential/model runtime.

An operator who explicitly approves one real classifier invocation may run:

```powershell
npm run smoke:native -- --authorize-live --model 'PROVIDER/MODEL-ID' --budget '{"requests":1,"inputBytes":4096,"concurrency":1,"maxWorkMs":10000,"maxAttemptMs":5000,"maxRetries":0}'
```

This example is a procedure, not authorization and not evidence that it was executed. Existing credentials must already be available through Pi. The script does not log in, acquire credentials, substitute models, allow retries or enable network model-catalog refresh. Missing available model/credentials yields `not_run`, never success.

The only evidence submitted is the fixed synthetic sentence **“Synthetic smoke fixture: the sky is blue.”** The boolean question asks whether it says the sky is blue; criteria describe yes/no. It does not read repository evidence. The refusal report prints the full fixed payload for inspection.

After authorization/model availability checks, the script creates a temporary, persisted Pi conversation, applies the exact one-request budget, and executes through the shared core. The session file is retained and its path is reported so the reservation/settlement can be inspected. A successful structurally valid answer reports `executed`; operational/model failure is separate. Neither proves semantic quality, benchmark benefit, or the later held-out release gates.

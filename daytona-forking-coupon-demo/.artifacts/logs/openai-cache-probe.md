# OpenAI Prompt Cache Probe

Generated: 2026-07-07T22:48:26.475Z
Model: gpt-4.1-mini
Run ID: coupon-2026-07-07T22-47-37-439Z

These rows are live OpenAI usage metadata. They show model-side prompt cache hits from reused serialized context, not Daytona copying OpenAI KV cache between sandboxes.

| Layer | Request | Input tokens | Cached tokens | Output tokens | Cache hit | Latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| layer 1 | parent context warm | 5152 | 0 | 61 | 0% | 4380ms |
| layer 1 | frontend-hypothesis | 5156 | 4992 | 69 | 97% | 2295ms |
| layer 1 | backend-hypothesis | 5156 | 4992 | 63 | 97% | 1592ms |
| layer 1 | contract-hypothesis | 5158 | 4992 | 73 | 97% | 1984ms |
| layer 2 | contract context warm | 3933 | 0 | 58 | 0% | 1922ms |
| layer 2 | contract-minimal | 3934 | 3712 | 69 | 94% | 1382ms |
| layer 2 | contract-with-regression-test | 3935 | 3712 | 95 | 94% | 1785ms |

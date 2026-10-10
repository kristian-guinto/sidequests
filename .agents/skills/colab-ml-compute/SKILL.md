---
name: colab-ml-compute
description: >-
  How to execute machine learning workloads, model training, inference, and benchmarks
  remotely on Google Colab GPUs/TPUs using the official Colab CLI (`google-colab-cli`).
  Includes strict credit budget checks, mandatory shutdown safeguards to prevent burning
  compute units, accelerator selection, and artifact retrieval workflows.
---

# Google Colab Remote ML Compute Workflow & Safeguards

This skill guides agents in running machine learning, deep learning, and time-series workloads (e.g., TimesFM, PyTorch, Hugging Face models) remotely on Google Colab GPUs/TPUs using the official CLI (`google-colab-cli`).

The CLI manages authentication via OAuth/ADC, allows spinning up ephemeral or managed GPU instances, executes Python scripts or Jupyter notebooks remotely, downloads artifacts, and tears down instances.

---

## 🛡️ Critical Safeguards (MANDATORY FOR ALL AGENTS)

Every agent MUST adhere to these rules without exception to protect the user's compute units:

### Safeguard 1: Pre-Execution Credit Balance Check
**Never provision an instance without verifying existing credit balance first.**
```bash
colab usage
```
- Inspect `Current balance: <N> compute units`.
- **Threshold Rule**:
  - If balance is **<= 5.0 compute units**, **DO NOT start GPU sessions**. Abort and prompt the user.
  - If balance is **0.00**, stop immediately.
- **Never trigger purchases**: Never run `colab pay` or suggest automated credit buying without explicit user command.

### Safeguard 2: Zero Idle Leaks (Immediate Lifecycle Shutdown)
**Never leave an idle Colab session running.** Active sessions continuously burn compute units (e.g. 1.54 to 10+ units/hr).
- **Rule A (Preferred)**: Use ephemeral execution via `colab run`:
  ```bash
  colab run --gpu L4 path/to/script.py
  ```
  `colab run` provisions the VM, streams execution, and **automatically tears down the VM** even if the script throws an uncaught exception.
- **Rule B (For multi-step sessions)**: If using `colab new -s <name>`, you MUST issue `colab stop -s <name>` in the same conversation turn or in a `finally` block as soon as commands finish.
- **Rule C (Final Verification)**: Before concluding your response to the user, you MUST run:
  ```bash
  colab usage
  ```
  and verify that:
  - `Active assignments: 0`
  - `Usage rate: 0.00/hr`

### Safeguard 3: Accelerator Tier Selection & Quota Fallbacks
Choose the right accelerator for the workload to minimize compute unit burn:
| Accelerator | Typical Cost | Best For | Flag |
| :--- | :--- | :--- | :--- |
| **NVIDIA L4 (24GB)** *(Recommended)* | ~1.54 units/hr | TimesFM 3.0, modern transformers, fast inference, batch scaling | `--gpu L4` |
| **NVIDIA T4 (16GB)** | ~1.00 units/hr | Lightweight models, small PyTorch scripts, budget runs | `--gpu T4` |
| **NVIDIA A100 (40GB)** | ~4-8 units/hr | Massive multi-billion parameter models, large batch training | `--gpu A100 --high-mem` |
| **Google TPU v5e / v6e** | Variable | JAX/Flax TPU optimized models | `--tpu v5e1` |
| **CPU** | Lowest | Non-GPU validation, small data transformations | *(omit flag)* |

- **Quota Error Handling**: If Colab returns HTTP `400` during allocation (e.g. A100 unavailable for the subscription tier), immediately fall back to `--gpu L4` or `--gpu T4`.

### Safeguard 4: Remote Environment Self-Containment
Remote VMs boot into a fresh Linux environment with working directory `/content`. Local repository packages are NOT automatically present on the VM.
- Scripts sent to the VM should either:
  1. Auto-bootstrap missing dependencies:
     ```python
     try:
         import timesfm
     except ImportError:
         import subprocess, sys
         subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "timesfm[torch]>=3.0.2"])
     ```
  2. Or install packages via the CLI before running:
     ```bash
     colab install -s <name> "timesfm[torch]>=3.0.2" matplotlib pandas
     ```

### Safeguard 5: Execution Timeout Protection
Always protect against runaway loops or deadlocks that could drain compute units indefinitely:
```bash
# Set explicit timeout in seconds (default is 30s for ephemeral jobs)
colab run --gpu L4 --timeout 300 path/to/script.py
```

### Safeguard 6: Retrieve Artifacts Before Stopping
Download output plots, metric logs, or weights *before* calling `colab stop`:
```bash
colab download -s <name> /content/outputs/plot.png local/path/plot.png
```

---

## 📋 Standard Recipes

### Recipe 1: One-Shot Ephemeral Job (Safest & Recommended)
Use when running a standalone script:
```bash
# 1. Check credit balance
colab usage

# 2. Run script with automatic teardown
colab run --gpu L4 --timeout 600 path/to/script.py

# 3. Confirm 0 active VMs
colab usage
```

### Recipe 2: Multi-Step Interactive Session
Use when you need to install packages, run multiple scripts, and download generated artifacts:
```bash
# 1. Check balance
colab usage

# 2. Provision session with a descriptive name
colab new -s ml-workload --gpu L4

# 3. Install packages (uses uv inside Colab)
colab install -s ml-workload "timesfm[torch]>=3.0.2" matplotlib pandas

# 4. Execute script remotely
colab exec -s ml-workload -f path/to/script.py

# 5. List and download results
colab ls -s ml-workload /content/outputs
colab download -s ml-workload /content/outputs/benchmark.png outputs/benchmark.png

# 6. STOP THE SESSION IMMEDIATELY
colab stop -s ml-workload

# 7. Verify zero running assignments
colab usage
```

### Recipe 3: Running a Jupyter Notebook Remotely
```bash
# 1. Check balance
colab usage

# 2. Provision session
colab new -s nb-run --gpu L4

# 3. Execute notebook (runs cells and creates <name>_output.ipynb)
colab exec -s nb-run -f notebook.ipynb

# 4. Stop session
colab stop -s nb-run
```

---

## 🔍 Troubleshooting & Recovery

- **Check Active Sessions**:
  ```bash
  colab sessions
  ```
- **Force Kill All Stale Sessions**:
  If an orphaned session is still running, stop it immediately:
  ```bash
  colab stop -s <session-name>
  ```
- **Inspect Execution Logs**:
  ```bash
  colab log -s <name> -n 30
  ```
- **Check Auth Status**:
  ```bash
  colab whoami
  ```
  If unauthenticated, run `colab whoami` and follow the OAuth URL prompt.

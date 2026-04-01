# Groundwork Platform Adoption

This pull request integrates your existing service with the Groundwork platform, enabling automated CI/CD, GitOps deployment, and compliance evidence collection.

## What's Been Added

### 1. CI/CD Pipeline (`.github/workflows/ci.yaml`)

- Wraps Groundwork reusable workflows for consistency
- Tests your existing code
- Builds container image from your existing Dockerfile (`CompendiumUI/Dockerfile`)
- Generates evidence artifacts:
  - **SBOM** (Software Bill of Materials)
  - **Vulnerability scan** (Trivy)
  - **Image signature** (Cosign)
  - **SLSA provenance** (build integrity attestation)
- Pushes signed image to ECR

### 2. Backstage Catalog Registration (`catalog-info.yaml`)

- Registers service in Backstage developer portal
- Links to source code, environment config, and ArgoCD
- Provides service metadata for discovery and documentation

### 3. Environment Configuration (Separate Repository)

A new repository `env-config-copyright-compendium` has been created with:

- **Kustomize overlays** for dev/stage/prod environments
- **ArgoCD Applications** for GitOps deployment
- **Kargo Stages** for progressive promotion (dev → stage → prod)
- **Network policies** and security configurations

## Required Changes Before Merging

### ✅ Health Endpoints

Ensure your service exposes these endpoints for Kubernetes health checks:

#### Liveness Probe: `/health`

Returns 200 OK if the service process is running.

**Example responses by language**:



```javascript
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});
```



#### Readiness Probe: `/ready`

Returns 200 OK if ready to accept traffic, 503 if not ready (e.g., waiting for database).



```javascript
app.get('/ready', async (req, res) => {
  // Check dependencies

  res.json({ status: 'ready' });
});
```



### ✅ Dockerfile Verification

Verify that `CompendiumUI/Dockerfile` exists and builds correctly:

```bash
docker build -f CompendiumUI/Dockerfile -t copyright-compendium:test .
docker run -p 8080:8080 copyright-compendium:test
```

Test the health endpoints:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

### ✅ Port Configuration

Verify the service listens on port `8080`. If this is incorrect, update:

- This PR: `.github/workflows/ci.yaml` (if needed for testing)
- Environment config: `env-config-copyright-compendium/kustomize/base/values.yaml`

### ✅ Test Configuration

The CI workflow includes a test job. Verify the test commands are appropriate for your service:

- Review `.github/workflows/ci.yaml`
- Update test commands if needed for your specific setup
- Ensure tests run successfully: `git checkout groundwork-adoption && [run your test command]`

## What Happens After Merging

1. **Automatic Build on Push to Main**:
   - GitHub Actions triggers on commits to `main`
   - Runs tests, builds container image
   - Scans for vulnerabilities (Trivy)
   - Signs image with Cosign (keyless signing)
   - Generates SBOM and SLSA provenance
   - Pushes to ECR: `<account>.dkr.ecr.us-east-1.amazonaws.com/copyright-compendium:latest`

2. **Evidence Storage**:
   - All artifacts stored in S3 evidence bucket
   - Immutable Object Lock prevents tampering
   - Used for compliance audits and promotion gates

3. **Ready for GitOps Deployment**:
   - Configure deployment in `env-config-copyright-compendium`
   - ArgoCD watches for changes and deploys to dev
   - Use Kargo to promote to stage/prod

## Next Steps After Merge

### 1. Configure Deployment

Clone the environment config repository:

```bash
git clone https://github.com/adhocteam/env-config-copyright-compendium.git
cd env-config-copyright-compendium
```

Update deployment configuration:

- **Image repository**: Verify ECR repository name in `kustomize/base/values.yaml`
- **Port**: Ensure service port matches (`8080`)
- **Environment variables**: Add any required env vars
- **Resources**: Set CPU/memory limits based on your service's needs
  

### 2. Deploy to Dev Environment

Push changes to the env-config repository:

```bash
git add .
git commit -m "Configure copyright-compendium deployment"
git push origin main
```

ArgoCD will automatically deploy to dev environment within minutes.

Monitor deployment:

```bash
# Watch ArgoCD application
kubectl get application copyright-compendium -n argocd --watch

# Check pod status
kubectl get pods -n copyright-compendium-dev

# View logs
kubectl logs -l app=copyright-compendium -n copyright-compendium-dev --follow
```

### 3. Test Dev Deployment

Once deployed, verify the service is healthy:

```bash
# Port-forward to test locally
kubectl port-forward -n copyright-compendium-dev svc/copyright-compendium 8080:80

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

Or access via ingress/load balancer (if configured).

### 4. Promote to Stage/Prod

Use Kargo to promote between environments:

```bash
# Promote to stage (via Kargo CLI or UI)
kargo promote --stage stage --project copyright-compendium

# Promotion includes compliance checks:
# - Image signature verification
# - Vulnerability scan thresholds
# - SLSA provenance validation

# After validation in stage, promote to prod
kargo promote --stage prod --project copyright-compendium
```

Or use the Kargo UI: `https://kargo.mvp.adhoc.team`


## Troubleshooting

### Build Failing

**Tests failing**:

- Review test configuration in `.github/workflows/ci.yaml`
- Run tests locally to debug
- Check for missing dependencies or environment variables

**Dockerfile build failing**:

- Verify `CompendiumUI/Dockerfile` path is correct
- Test build locally: `docker build -f CompendiumUI/Dockerfile .`
- Check for syntax errors or missing files

**Vulnerability scan blocking**:

- Review Trivy scan results in GitHub Actions logs
- Update dependencies with known vulnerabilities
- For dev environment, you can temporarily disable `fail_on_critical`

### Deployment Issues

**ArgoCD not syncing**:

- Check Application status: `kubectl get application copyright-compendium -n argocd`
- Review ArgoCD logs for errors
- Verify repository access and credentials

**Pods crash looping**:

- Check logs: `kubectl logs -l app=copyright-compendium -n <namespace>`
- Verify health endpoints return 200
- Check for missing environment variables or configuration
  

**Health check failures**:

- Ensure `/health` and `/ready` endpoints exist and return 200
- Check readiness probe: `kubectl describe pod <pod-name>`
- Port configuration mismatch: verify service listens on `8080`

### Promotion Blocked

**Pre-deploy verifier rejecting**:

- Image not signed: Check Cosign signing in CI logs
- Vulnerability threshold exceeded: Review and remediate CVEs
- SLSA provenance missing: Ensure evidence pipeline completed

**Check evidence artifacts**:

```bash
# List evidence in S3
aws s3 ls s3://<evidence-bucket>/mvp/copyright-compendium/
```

## Resources

- **Original Repository**: https://github.com/adhocteam/copyright-compendium
- **Environment Config**: https://github.com/adhocteam/env-config-copyright-compendium
- **Platform Documentation**: [Adoption User Story](https://github.com/adhocteam/groundwork-redux/docs/user-stories/adopt-existing-service.md)
- **Developer Guide**: [Groundwork Developer Guide](https://github.com/adhocteam/groundwork-redux/docs/guides/dev_guide.md)

## Support

- **File Issues**: [groundwork-redux/issues](https://github.com/adhocteam/groundwork-redux/issues)
- **Slack**: #groundwork-support

---

**Created by**: Backstage `adopt-existing-service` template
**Service**: copyright-compendium
**Language**: nodejs
**Port**: 8080

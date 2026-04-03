# Deploy on Oracle Cloud — Ubuntu 22.04 (single VM)

This is the simplest path: one **Compute** instance in a **public subnet**, **Docker**, and this repo on the VM. You do not need Kubernetes or a load balancer to start.

## 1. Subnets in one minute

| Kind | Typical use here |
|------|------------------|
| **Public subnet** | Route table sends `0.0.0.0/0` to an **Internet Gateway**. VMs can get a **public IP**. **Use this** for your first app server so you can SSH from your laptop and serve HTTP(S) to the internet. |
| **Private subnet** | No direct inbound from the internet; outbound usually via **NAT gateway**. Better for databases or app tiers behind a load balancer—**skip for now**. |

**For your first deployment:** put the instance in a **public subnet**, enable **Assign public IPv4 address**, and use **security rules** (see below) instead of trying to “hide” the VM in a private subnet.

When you use OCI’s **VCN wizard** (“Create VCN with related resources”), it often creates a public subnet for you—check that the subnet’s route table has a **default route** (`0.0.0.0/0`) to an **Internet Gateway**.

## 2. Security lists / NSGs (firewall)

For your app VM’s **VNIC** (or subnet security list), add **ingress**:

| Source | Protocol | Ports | Purpose |
|--------|----------|-------|---------|
| Your home IP (or `0.0.0.0/0` only while testing) | TCP | **22** | SSH |
| `0.0.0.0/0` (or tighter later) | TCP | **80**, **443** | HTTP/HTTPS if you use a reverse proxy |
| Same | TCP | **3500** | App directly (Compose default); **close this** once you terminate TLS on 443 |

**Egress:** allow all (default is often fine) so the VM can pull Docker images and run `apt update`.

## 3. Create the instance

- **Image:** Canonical Ubuntu 22.04 (aarch64 or x86—match your shape).
- **Shape:** Ampere A1 (free tier) or any small VM.
- **Networking:** your **public subnet**, **public IPv4** assigned.
- **SSH key:** paste your **public** key (from `~/.ssh/id_ed25519.pub` or similar).
- **Cloud-init (optional):** paste the contents of [`scripts/oci-ubuntu-cloud-init.yaml`](../scripts/oci-ubuntu-cloud-init.yaml) into **“User data”** so Docker is installed on first boot. If you skip this, follow **section 5** after SSH.

## 4. Put this project on the VM

**Option A — Git (recommended long term)**

1. On your laptop, in the project folder: create a **private** repo on GitHub/GitLab, then:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

2. On the VM (after SSH):

   ```bash
   sudo apt update && sudo apt install -y git
   git clone git@github.com:YOUR_USER/YOUR_REPO.git powerbuilding
   cd powerbuilding
   ```

   Use **HTTPS clone + personal access token** if you don’t use SSH keys on the VM yet.

**Option B — No git yet**

From your laptop (replace user and IP):

```bash
rsync -avz --exclude node_modules --exclude .next "./PowerBuilding UI APP/" ubuntu@YOUR_PUBLIC_IP:~/powerbuilding/
```

SSH in and `cd ~/powerbuilding`.

## 5. Install Docker on Ubuntu 22.04 (if cloud-init did not)

Run on the VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and SSH back in so **docker** group applies. Test: `docker run --rm hello-world`

## 6. Run the app

From the project directory on the VM:

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
docker compose up --build -d
```

Open `http://YOUR_PUBLIC_IP:3500` (security list must allow **3500**).

See [DEPLOY.md](./DEPLOY.md) for SQLite volume behavior, seed user, and resets. First boot on an empty volume loads the exercise catalog automatically (see entrypoint + `ensure-seed-if-empty`).

## 7. Next steps (when you’re ready)

- Put **Nginx** (or Caddy) in front with **Let’s Encrypt** on port 443; stop exposing 3500 publicly.
- **Backups:** copy the Docker volume / SQLite file on a schedule (OCI **Block Volume** backups or your own script).
- **Free tier:** Arm instances may need an **Arm image** build; if `docker build` fails on architecture, we can add buildx notes or a multi-arch Dockerfile—fix when you hit it.

## Related

- [GIT_DEPLOY.md](./GIT_DEPLOY.md) — push from laptop, `git pull` on this VM, run Compose.
- [DEPLOY.md](./DEPLOY.md) — Docker Compose, env vars, DB reset, local dev.

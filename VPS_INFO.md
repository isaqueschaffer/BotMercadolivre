# 🌐 Informações de Acesso à VPS (Oracle Cloud)

Este documento contém todas as credenciais e configurações de infraestrutura da máquina virtual (VPS) na nuvem onde o robô de afiliados está hospedado e operando 24/7.

---

## 📌 Provedor e Conta
- **Empresa:** Oracle Cloud Infrastructure (OCI)
- **Plano:** Always Free (Gratuito para sempre)
- **Região:** Brazil East (São Paulo) / `sa-saopaulo-1`
- **Tenancy:** `isaqueSchaffer`
- **Usuário / E-mail:** `isaquegbs@gmail.com`

---

## 💻 Dados da Máquina Virtual (Compute Instance)
- **Nome da Instância:** `bot-mercadolivre`
- **Sistema Operacional:** Canonical Ubuntu 24.04 LTS
- **Shape / Recursos:** `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM, 47 GB Disco)
- **IP Público:** `144.22.237.86`
- **IP Privado:** `10.0.0.111`
- **Porta do Painel Web:** `4000`
- **Link do Painel:** [http://144.22.237.86:4000](http://144.22.237.86:4000)

---

## 🔑 Acesso SSH (Terminal)
- **Usuário SSH:** `ubuntu`
- **Porta SSH:** `22`
- **Arquivo de Chave Privada:** `oracle-vps.key` *(salvo na raiz deste repositório)*

### Comando para conectar via terminal (PowerShell / Linux / Mac):
```bash
ssh -i oracle-vps.key ubuntu@144.22.237.86
```

---

## 🌐 Configuração de Rede (VCN & Sub-rede)
- **Virtual Cloud Network (VCN):** `bot-mercadolivre`
  - **Bloco CIDR VCN:** `10.0.0.0/16`
- **Sub-rede Pública:** `public subnet-bot-mercadolivre`
  - **Bloco CIDR Sub-rede:** `10.0.0.0/24`
- **Internet Gateway:** `Internet gateway-bot-mercadolivre`
- **Lista de Segurança:** `default security list for bot-mercadolivre`
  - **Regra de Entrada (SSH):** Porta `22` (TCP, origem `0.0.0.0/0`)
  - **Regra de Entrada (Dashboard):** Porta `4000` (TCP, origem `0.0.0.0/0`)

---

## ⚡ Otimização de Memória
- **Memória RAM Física:** 1 GB
- **Memória Swap no SSD:** 4 GB (`/swapfile` ativado e persistido no `/etc/fstab`)

---

## 🔄 Deploy Automático (CI/CD via GitHub Actions)
O repositório possui integração contínua (CI/CD) configurada via **GitHub Actions** (`.github/workflows/deploy.yml`).

- **Como funciona:** Sempre que um commit for enviado para a branch `main` (`git push origin main`), o GitHub Actions:
  1. Conecta via SSH na VPS usando as credenciais seguras (`secrets.VPS_SSH_KEY`, etc.).
  2. Transfere os arquivos atualizados para `~/app`.
  3. Reconstrói o container Docker automaticamente (`sudo docker compose up --build -d`).
  4. Mantém o banco SQLite (`data/`) e a sessão do WhatsApp (`auth/`) intactos.
- **Histórico e Status de Deploys:** Você pode acompanhar o status de cada deploy na aba **Actions** do repositório no GitHub:
  👉 [https://github.com/isaqueschaffer/BotMercadolivre/actions](https://github.com/isaqueschaffer/BotMercadolivre/actions)

---

## 🚀 Gerenciamento Manual do Bot no Servidor
O código do bot está localizado na pasta `~/app` da máquina.

### Ver logs em tempo real:
```bash
sudo docker logs -f affiliate-bot
```

### Reiniciar o bot:
```bash
cd ~/app && sudo docker compose restart
```

### Reconstruir e atualizar a aplicação manualmente:
```bash
cd ~/app && sudo docker compose up --build -d
```


# ⚡ Airflow + dbt Starter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.7+](https://img.shields.io/badge/Python-3.7+-green.svg)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Required-blue.svg)](https://docker.com)

### Stack completa de data engineering com Apache Airflow, dbt Core e PostgreSQL — configurada e rodando em 2 minutos.

[English version](README.en.md)

<!-- TODO: substituir por GIF do wizard rodando -->
<!-- ![GC Data Templates - Airflow + dbt Starter](docs/assets/wizard-demo.gif) -->

---

## Por que usar este template?

- 🖥️ **Setup visual em 2 minutos** — interface web guia toda a configuração, sem editar arquivos manualmente
- 🔄 **Detecta configuração existente** — não reconfigura do zero, só sobe os serviços
- 📋 **Deploy com um clique** — stepper visual com logs em tempo real
- 🖥️ **Cross-platform** — funciona no Windows, Mac e Linux
- 🛢️ **SQL UI inclusa** — Adminer integrado para consultar os dados direto no browser
- 🧪 **Projeto dbt real** — staging, marts, testes de qualidade e seeds, não um exemplo trivial

---

## Quick Start

```bash
# 1. Clone o repositório
git clone https://github.com/gc-data/airflow-dbt-starter.git
cd airflow-dbt-starter

# 2. Execute o wizard (só precisa de Python)
python setup.py

# 3. Configure via interface web e clique "Deploy"
```

O wizard abre no browser, verifica pré-requisitos e guia você pela configuração.

<!-- TODO: adicionar screenshots reais -->
<!-- ![Setup Wizard - Welcome](docs/assets/wizard-welcome.png) -->
<!-- ![Setup Wizard - Deploy](docs/assets/wizard-deploy.png) -->

> **Sem Make?** Todos os comandos funcionam diretamente: `bash scripts/deploy.sh`, `bash scripts/smoke-test.sh`, etc.

---

## O que vem incluído

- **Apache Airflow 2.9** — Orquestrador de workflows com interface web
- **dbt Core 1.8** — Transformação de dados com SQL versionado
- **PostgreSQL 16** — Banco de dados como backend do Airflow e warehouse do dbt
- **Adminer** — Interface SQL web para consultar os dados diretamente
- **3 DAGs de exemplo** — ETL simples, dbt run e task groups
- **Projeto dbt completo** — Seeds, staging models, marts e testes
- **Setup Wizard** — Interface web para configurar tudo sem editar arquivos

## Serviços

Após o deploy, os seguintes serviços ficam disponíveis:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Airflow | http://localhost:8080 | Orquestrador de workflows |
| Adminer | http://localhost:8081 | Interface SQL web |
| PostgreSQL | localhost:5432 | Banco de dados |

> As portas são configuráveis pelo wizard.

---

## DAGs de Exemplo

| DAG | Descrição |
|-----|-----------|
| `example_simple_etl` | Pipeline ETL básico: extract → transform → load |
| `example_dbt_run` | Executa dbt: deps → seed → staging → marts → test |
| `example_task_groups` | Extração paralela com Task Groups do Airflow 2.x |

## Modelos dbt

### Staging (views)
- `stg_customers` — Clientes limpos e padronizados
- `stg_orders` — Pedidos limpos e padronizados

### Marts (tabelas)
- `dim_customers` — Dimensão de clientes com métricas de pedidos e classificação por tier
- `fct_orders` — Tabela fato de pedidos enriquecida com dados do cliente

---

## Comandos Úteis

```bash
make setup       # Abre o wizard de configuração
make up          # Sobe os containers
make down        # Para os containers
make logs        # Acompanha os logs
make health      # Verifica saúde dos serviços
make adminer     # Mostra URL do Adminer (SQL UI)
make dbt-run     # Executa os modelos dbt
make dbt-test    # Roda os testes dbt
make dbt-seed    # Carrega os seeds
make smoke-test  # Testa tudo de ponta a ponta
make clean       # Remove tudo (containers + volumes)
```

> **Sem Make instalado?** Rode diretamente: `python setup.py`, `docker compose up -d`, `bash scripts/deploy.sh`, etc.

---

## Estrutura do Projeto

```
airflow-dbt-starter/
├── setup.py                 ← Wizard (python setup.py)
├── wizard.json              ← Configuração do wizard
├── Dockerfile               ← Airflow + dbt
├── Makefile                 ← Atalhos de comandos
├── setup-ui/                ← Frontend do wizard (React pré-compilado)
├── src/
│   ├── dags/                ← DAGs do Airflow
│   │   ├── example_simple.py
│   │   ├── example_dbt_run.py
│   │   └── example_task_groups.py
│   └── dbt/                 ← Projeto dbt
│       ├── models/
│       │   ├── staging/     ← Views limpas
│       │   └── marts/       ← Tabelas finais
│       └── seeds/           ← Dados de exemplo
├── templates/               ← Templates de configuração (.env, docker-compose, etc)
├── scripts/                 ← Scripts de deploy, cleanup, health check e smoke test
└── docs/
```

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) (com Docker Compose v2)
- [Python 3.7+](https://www.python.org/downloads/) (apenas para o wizard)

## Configuração Manual (sem wizard)

Se preferir configurar manualmente:

1. Copie `templates/.env.tpl` para `.env` e preencha os valores
2. Copie `templates/docker-compose.yml.tpl` para `docker-compose.yml`
3. Copie `templates/profiles.yml.tpl` para `src/dbt/profiles.yml`
4. Copie `templates/dbt_project.yml.tpl` para `src/dbt/dbt_project.yml`
5. Execute `docker compose up -d`

---

## Solução de Problemas

**Airflow demora para inicializar:** Na primeira execução, o Airflow precisa criar o banco, migrar schemas e criar o usuário admin. Isso pode levar 30-60 segundos.

**Porta já em uso:** O wizard permite escolher portas diferentes. Se configurar manualmente, edite o `.env`.

**dbt falha no primeiro run:** Certifique-se que o PostgreSQL está healthy antes de rodar `make dbt-run`. Use `make health` para verificar.

**Containers não sobem:** Verifique se o Docker está rodando com `docker info`. Se estiver no Windows, confirme que o Docker Desktop está ativo.

---

## Gostou?

⭐ Dê uma estrela no repositório — ajuda mais pessoas a encontrar o projeto.

🎓 **Aprenda a construir pipelines como este** na [GC Data Academy](https://gcdatac.com/academy) — toda semana um desafio novo de data engineering.

🚀 Conheça nossos [templates premium](https://gcdatac.com/templates) — alertas inteligentes para Airflow, segurança GCP com Terraform, e mais.

---

**Feito por [GC Data](https://gcdatac.com)** | [Academy](https://gcdatac.com/academy) · [Templates](https://gcdatac.com/templates) · [Consulting](https://gcdatac.com/consulting)

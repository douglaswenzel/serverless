# 🔄 Como Sincronizar de Volta para o Workspace

Se quiser copiar tudo de volta para o workspace em `C:\Users\fadig\OneDrive\Área de Trabalho\ProjetoAWS` quando houver espaço, execute:

## Opção 1: Copiar Diretórios Inteiros

```powershell
# No PowerShell, execute:

# Liberar espaço em C: primeiro (delete arquivos desnecessários)
$sourceDir = "E:\api-serverless-e"
$targetDir = "C:\Users\fadig\OneDrive\Área de Trabalho\ProjetoAWS"

# Copiar tudo
Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force

# Reiniciar o repositório git
cd $targetDir
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "Initial commit - Lambda functions and API"

Write-Host "✓ Sincronização concluída!"
```

## Opção 2: Via Git

```bash
cd C:\Users\fadig\OneDrive\Área de Trabalho\ProjetoAWS
git init
git remote add origin https://github.com/festmedeiros/api-serverless
git fetch origin
git checkout -b main origin/main
git pull origin main
```

## Opção 3: Usar Git do Repositório Original

Se você fizer um fork ou criar um branch, pode fazer:

```bash
# Adicionar remoto
git remote add upstream E:\api-serverless-e
git fetch upstream
git merge upstream/main
```

---

## 📌 Importante

- Os arquivos em `E:\api-serverless-e` são **os definitivos**
- Sincronize quando C: tiver espaço disponível
- Não apague `E:\api-serverless-e` até ter sucesso em C:
- O `node_modules` é grande, pode ser regenerado com `npm install`

---

## 🎯 Próximas Ações

1. **Agora:** Trabalhe em `E:\api-serverless-e` para AWS deployment
2. **Depois:** Sincronize para C: quando tiver espaço
3. **Finally:** Push para GitHub if needed

---

**Stay focused on AWS deployment! You're almost there.** 🚀

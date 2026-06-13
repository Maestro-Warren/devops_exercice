# GitLab Local — Setup Complet (Hors Ligne)

## 1. Lancer GitLab

```bash
cd ~/devops-exercices/gitlab
docker-compose up -d
```

Premier démarrage = 3-5 minutes (GitLab est lourd). Attendre que ça se stabilise :
```bash
docker logs -f gitlab
# Attendre de voir : "gitlab Reconfigured!"
```

## 2. Récupérer le mot de passe root

```bash
docker exec gitlab cat /etc/gitlab/initial_root_password
```

- Username : `root`
- Password : celui affiché par la commande ci-dessus
- Ce mot de passe expire après 24h — change-le au premier login

## 3. Se connecter

Ouvrir http://localhost dans ton navigateur.
Login : root / (mot de passe récupéré)

## 4. Créer un projet

1. http://localhost → "New Project" → "Create blank project"
2. Nom : `projet-01` (ou autre)
3. Visibility : Private
4. Décocher "Initialize with README"
5. Create project

## 5. Pousser ton code vers GitLab local

```bash
cd ~/devops-exercices/projet-01-html-basic
git init
git add .
git commit -m "initial commit"

# Ajouter GitLab local comme remote (port 2222 pour SSH ou HTTP sur port 80)
# Option HTTP (plus simple) :
git remote add origin http://localhost/root/projet-01.git

# Pousser
git push -u origin main
# Username: root
# Password: ton mot de passe
```

### Pour éviter de taper le mot de passe à chaque push :
```bash
# Stocker les credentials en cache
git config --global credential.helper store
# La prochaine fois que tu tapes le mdp, il sera mémorisé
```

### OU utiliser SSH (port 2222) :
```bash
# Générer une clé SSH si tu n'en as pas :
ssh-keygen -t ed25519 -C "ton@email.com"

# Copier la clé publique :
cat ~/.ssh/id_ed25519.pub
# Coller dans : GitLab → Preferences → SSH Keys → Add key

# Configurer le remote en SSH :
git remote add origin ssh://git@localhost:2222/root/projet-01.git
git push -u origin main
```

## 6. Connecter Jenkins à GitLab local

### Ajouter le credential GitLab dans Jenkins :
1. Jenkins → Manage Jenkins → Credentials → Add
2. Type : **Username with password**
3. ID : `gitlab-creds`
4. Username : `root`
5. Password : ton mot de passe GitLab

### Créer le job Pipeline dans Jenkins :
1. New Item → Pipeline → "projet-01"
2. Pipeline → Definition → "Pipeline script from SCM"
3. SCM → Git
4. Repository URL : `http://gitlab:80/root/projet-01.git`
   - **ATTENTION** : utiliser `gitlab` (le nom du conteneur) si Jenkins est aussi en Docker
   - OU `http://host.docker.internal/root/projet-01.git` si Jenkins tourne dans Docker et GitLab aussi
   - OU `http://localhost/root/projet-01.git` si Jenkins est installé directement sur ta machine
5. Credentials → sélectionner `gitlab-creds`
6. Branch : `*/main`
7. Save → Build Now

### Si Jenkins et GitLab sont TOUS LES DEUX dans Docker :
Ils doivent être sur le même réseau Docker pour se parler :

```yaml
# Dans le docker-compose de Jenkins, ajouter :
networks:
  - gitlab_default

# OU créer un réseau partagé
```

**Solution plus simple** — ajouter au docker-compose de Jenkins :
```yaml
services:
  jenkins:
    ...
    extra_hosts:
      - "gitlab.local:host-gateway"
```

Ou lancer les 2 dans le même docker-compose (voir section suivante).

## 7. Docker Compose TOUT-EN-UN (GitLab + Jenkins)

Si tu veux TOUT dans un seul fichier :

```yaml
version: '3.8'

services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: gitlab
    hostname: gitlab.local
    ports:
      - "80:80"
      - "2222:22"
    volumes:
      - gitlab-config:/etc/gitlab
      - gitlab-logs:/var/log/gitlab
      - gitlab-data:/var/opt/gitlab
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'http://gitlab'
        gitlab_rails['gitlab_shell_ssh_port'] = 2222
    shm_size: '256m'
    restart: unless-stopped

  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins-data:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    user: root
    restart: unless-stopped
    depends_on:
      - gitlab

volumes:
  gitlab-config:
  gitlab-logs:
  gitlab-data:
  jenkins-data:
```

Avec cette config :
- GitLab est accessible à http://localhost (depuis ton navigateur)
- Jenkins est accessible à http://localhost:8080 (depuis ton navigateur)
- Jenkins parle à GitLab via `http://gitlab/root/projet-01.git` (nom du service = hostname)

## 8. Configurer le Webhook (GitLab → Jenkins)

### Côté Jenkins :
1. Job → Configure → Build Triggers
2. Cocher **"Build when a change is pushed to GitLab"**
3. Copier l'URL du webhook (ex: http://jenkins:8080/project/projet-01)

### Côté GitLab :
1. Projet → Settings → Webhooks
2. URL : `http://jenkins:8080/project/projet-01`
   (utiliser `jenkins` car ils sont sur le même réseau Docker)
3. Trigger : Push events ✓
4. SSL verification : décocher (on est en local, pas de HTTPS)
5. Add webhook

### Autoriser les requêtes locales (important !) :
Par défaut GitLab bloque les webhooks vers localhost/réseau local.
1. GitLab → Admin Area (icône clé) → Settings → Network
2. Outbound requests → cocher **"Allow requests to the local network from webhooks and integrations"**
3. Save

## 9. Modifier le Jenkinsfile pour GitLab

Dans tes Jenkinsfiles, remplacer :
```groovy
triggers {
    githubPush()
}
```

Par :
```groovy
triggers {
    gitlab(triggerOnPush: true)
}
```

Ou simplement supprimer le trigger et utiliser le webhook directement (Jenkins le détecte).

Le reste du Jenkinsfile (stages, docker build, push, etc.) ne change PAS.
GitLab remplace juste GitHub comme source du code.

## 10. Différences GitHub vs GitLab local

| | GitHub | GitLab local |
|---|--------|-------------|
| URL repo | github.com/user/repo.git | localhost/root/repo.git |
| Webhook URL | http://jenkins:8080/github-webhook/ | http://jenkins:8080/project/NOM-JOB |
| Trigger Jenkinsfile | `githubPush()` | `gitlab(triggerOnPush: true)` |
| Plugin Jenkins | GitHub Integration | GitLab Plugin |
| Accès internet | Nécessaire | NON — tout en local |
| SSH port | 22 | 2222 (pour éviter conflit) |

## 11. Plugin Jenkins pour GitLab

Installer dans Jenkins :
- Jenkins → Manage Jenkins → Plugins → Available
- Rechercher : **GitLab Plugin**
- Installer + redémarrer

## 12. Commandes utiles

```bash
# Voir l'état de GitLab
docker exec gitlab gitlab-ctl status

# Redémarrer GitLab (si lent)
docker exec gitlab gitlab-ctl restart

# Voir l'espace disque utilisé
docker system df

# Arrêter tout
docker-compose down

# Arrêter et SUPPRIMER les données (reset complet)
docker-compose down --volumes
```

## 13. Ressources machine recommandées

GitLab est GOURMAND :
- RAM : minimum 4 Go pour GitLab seul, 8 Go pour GitLab + Jenkins
- CPU : 2+ cœurs
- Disque : 10+ Go

Si ta machine a moins de 8 Go de RAM, GitLab sera TRÈS lent au démarrage.
Astuce : dans GITLAB_OMNIBUS_CONFIG, ajouter :
```
puma['worker_processes'] = 2
sidekiq['max_concurrency'] = 5
```
pour réduire la consommation mémoire.

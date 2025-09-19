#!/usr/bin/env python3
"""
部署脚本 - 自动化部署俄罗斯方块游戏
支持多种部署环境：开发、测试、生产
"""

import os
import sys
import subprocess
import argparse
import json
import time
from pathlib import Path


class DeploymentManager:
    """部署管理器"""
    
    def __init__(self, environment='production'):
        self.environment = environment
        self.project_root = Path(__file__).parent
        self.config = self.load_deployment_config()
        
    def load_deployment_config(self):
        """加载部署配置"""
        config_file = self.project_root / 'deployment' / f'{self.environment}.json'
        
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        # 默认配置
        return {
            'app_name': 'tetris-game',
            'port': 5000,
            'workers': 4,
            'timeout': 120,
            'max_requests': 1000,
            'preload': True,
            'bind': '0.0.0.0:5000'
        }
    
    def check_prerequisites(self):
        """检查部署前提条件"""
        print("🔍 检查部署前提条件...")
        
        # 检查Python版本
        if sys.version_info < (3, 8):
            raise Exception("需要Python 3.8或更高版本")
        
        # 检查必需的文件
        required_files = [
            'app.py',
            'requirements.txt',
            'config.py',
            'config_production.py'
        ]
        
        for file in required_files:
            if not (self.project_root / file).exists():
                raise Exception(f"缺少必需文件: {file}")
        
        # 检查环境变量
        required_env_vars = [
            'SECRET_KEY',
            'DATABASE_URL'
        ]
        
        missing_vars = []
        for var in required_env_vars:
            if not os.environ.get(var):
                missing_vars.append(var)
        
        if missing_vars:
            print(f"⚠️  缺少环境变量: {', '.join(missing_vars)}")
            print("请设置这些环境变量或在.env文件中定义")
        
        print("✅ 前提条件检查完成")
    
    def install_dependencies(self):
        """安装依赖"""
        print("📦 安装Python依赖...")
        
        # 升级pip
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True)
        
        # 安装依赖
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], check=True)
        
        # 生产环境额外依赖
        if self.environment == 'production':
            production_deps = [
                'gunicorn',
                'redis',
                'psycopg2-binary',
                'sentry-sdk[flask]',
                'prometheus-client'
            ]
            
            subprocess.run([sys.executable, '-m', 'pip', 'install'] + production_deps, check=True)
        
        print("✅ 依赖安装完成")
    
    def setup_database(self):
        """设置数据库"""
        print("🗄️  设置数据库...")
        
        try:
            # 运行数据库迁移
            from services.database_manager import DatabaseManager
            
            db_manager = DatabaseManager()
            db_manager.initialize_database()
            
            print("✅ 数据库设置完成")
        except Exception as e:
            print(f"❌ 数据库设置失败: {e}")
            raise
    
    def run_tests(self):
        """运行测试"""
        print("🧪 运行测试...")
        
        try:
            # 运行单元测试
            result = subprocess.run([
                sys.executable, '-m', 'pytest', 
                'tests/', '-v', '--tb=short'
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                print("❌ 测试失败:")
                print(result.stdout)
                print(result.stderr)
                raise Exception("测试失败")
            
            print("✅ 所有测试通过")
        except FileNotFoundError:
            print("⚠️  pytest未安装，跳过测试")
    
    def build_static_assets(self):
        """构建静态资源"""
        print("🎨 构建静态资源...")
        
        static_dir = self.project_root / 'static'
        
        # 压缩CSS和JS文件
        self.minify_css()
        self.minify_js()
        
        # 生成资源清单
        self.generate_asset_manifest()
        
        print("✅ 静态资源构建完成")
    
    def minify_css(self):
        """压缩CSS文件"""
        css_dir = self.project_root / 'static' / 'css'
        
        if not css_dir.exists():
            return
        
        try:
            import csscompressor
            
            for css_file in css_dir.glob('*.css'):
                if css_file.name.endswith('.min.css'):
                    continue
                
                with open(css_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                minified = csscompressor.compress(content)
                
                min_file = css_file.parent / f"{css_file.stem}.min.css"
                with open(min_file, 'w', encoding='utf-8') as f:
                    f.write(minified)
                
                print(f"  压缩CSS: {css_file.name} -> {min_file.name}")
        
        except ImportError:
            print("  跳过CSS压缩 (csscompressor未安装)")
    
    def minify_js(self):
        """压缩JavaScript文件"""
        js_dir = self.project_root / 'static' / 'js'
        
        if not js_dir.exists():
            return
        
        try:
            import jsmin
            
            for js_file in js_dir.glob('*.js'):
                if js_file.name.endswith('.min.js'):
                    continue
                
                with open(js_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                minified = jsmin.jsmin(content)
                
                min_file = js_file.parent / f"{js_file.stem}.min.js"
                with open(min_file, 'w', encoding='utf-8') as f:
                    f.write(minified)
                
                print(f"  压缩JS: {js_file.name} -> {min_file.name}")
        
        except ImportError:
            print("  跳过JS压缩 (jsmin未安装)")
    
    def generate_asset_manifest(self):
        """生成资源清单"""
        static_dir = self.project_root / 'static'
        manifest = {}
        
        for asset_file in static_dir.rglob('*'):
            if asset_file.is_file():
                relative_path = asset_file.relative_to(static_dir)
                manifest[str(relative_path)] = {
                    'size': asset_file.stat().st_size,
                    'mtime': asset_file.stat().st_mtime
                }
        
        manifest_file = static_dir / 'manifest.json'
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"  生成资源清单: {len(manifest)} 个文件")
    
    def create_systemd_service(self):
        """创建systemd服务文件"""
        if self.environment != 'production':
            return
        
        print("⚙️  创建systemd服务...")
        
        service_content = f"""[Unit]
Description=Tetris Game Web Application
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory={self.project_root}
Environment=FLASK_ENV=production
Environment=PYTHONPATH={self.project_root}
ExecStart={sys.executable} -m gunicorn --config gunicorn.conf.py app:app
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""
        
        service_file = Path('/etc/systemd/system/tetris-game.service')
        
        try:
            with open(service_file, 'w') as f:
                f.write(service_content)
            
            # 重新加载systemd
            subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
            subprocess.run(['sudo', 'systemctl', 'enable', 'tetris-game'], check=True)
            
            print("✅ systemd服务创建完成")
        except PermissionError:
            print("⚠️  需要sudo权限创建systemd服务")
            print("请手动创建服务文件:")
            print(service_content)
    
    def create_nginx_config(self):
        """创建Nginx配置"""
        if self.environment != 'production':
            return
        
        print("🌐 创建Nginx配置...")
        
        nginx_config = f"""server {{
    listen 80;
    server_name your-domain.com;  # 请修改为实际域名
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}}

server {{
    listen 443 ssl http2;
    server_name your-domain.com;  # 请修改为实际域名
    
    # SSL配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 静态文件
    location /static/ {{
        alias {self.project_root}/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip on;
        gzip_types text/css application/javascript image/svg+xml;
    }}
    
    # WebSocket支持
    location /socket.io/ {{
        proxy_pass http://127.0.0.1:{self.config['port']};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
    
    # 应用代理
    location / {{
        proxy_pass http://127.0.0.1:{self.config['port']};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }}
}}
"""
        
        config_file = Path('/etc/nginx/sites-available/tetris-game')
        
        try:
            with open(config_file, 'w') as f:
                f.write(nginx_config)
            
            # 启用站点
            symlink = Path('/etc/nginx/sites-enabled/tetris-game')
            if not symlink.exists():
                symlink.symlink_to(config_file)
            
            # 测试配置
            subprocess.run(['sudo', 'nginx', '-t'], check=True)
            
            print("✅ Nginx配置创建完成")
            print("⚠️  请修改配置中的域名和SSL证书路径")
        except PermissionError:
            print("⚠️  需要sudo权限创建Nginx配置")
            print("请手动创建配置文件:")
            print(nginx_config)
    
    def create_gunicorn_config(self):
        """创建Gunicorn配置"""
        print("🦄 创建Gunicorn配置...")
        
        gunicorn_config = f"""# Gunicorn配置文件
import multiprocessing

# 服务器套接字
bind = "{self.config['bind']}"
backlog = 2048

# 工作进程
workers = {self.config['workers']}
worker_class = "eventlet"
worker_connections = 1000
timeout = {self.config['timeout']}
keepalive = 2
max_requests = {self.config['max_requests']}
max_requests_jitter = 50
preload_app = {self.config['preload']}

# 日志
accesslog = "logs/gunicorn_access.log"
errorlog = "logs/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 进程命名
proc_name = "{self.config['app_name']}"

# 安全
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# SSL (如果需要)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"

def when_ready(server):
    server.log.info("Server is ready. Spawning workers")

def worker_int(worker):
    worker.log.info("worker received INT or QUIT signal")

def pre_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_worker_init(worker):
    worker.log.info("Worker initialized (pid: %s)", worker.pid)

def worker_abort(worker):
    worker.log.info("Worker aborted (pid: %s)", worker.pid)
"""
        
        config_file = self.project_root / 'gunicorn.conf.py'
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(gunicorn_config)
        
        print("✅ Gunicorn配置创建完成")
    
    def create_docker_files(self):
        """创建Docker文件"""
        print("🐳 创建Docker文件...")
        
        # Dockerfile
        dockerfile_content = f"""FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn eventlet

# 复制应用代码
COPY . .

# 创建非root用户
RUN useradd --create-home --shell /bin/bash app \\
    && chown -R app:app /app
USER app

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:5000/health || exit 1

# 启动命令
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
"""
        
        with open(self.project_root / 'Dockerfile', 'w') as f:
            f.write(dockerfile_content)
        
        # docker-compose.yml
        compose_content = f"""version: '3.8'

services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://tetris:password@db:5432/tetris
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${{SECRET_KEY}}
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=tetris
      - POSTGRES_USER=tetris
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tetris"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:6-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web
    restart: unless-stopped

volumes:
  postgres_data:
"""
        
        with open(self.project_root / 'docker-compose.yml', 'w') as f:
            f.write(compose_content)
        
        # .dockerignore
        dockerignore_content = """__pycache__
*.pyc
*.pyo
*.pyd
.Python
env
pip-log.txt
pip-delete-this-directory.txt
.tox
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.mypy_cache
.pytest_cache
.hypothesis

.DS_Store
.vscode
.idea
*.swp
*.swo

instance/
.webassets-cache
.env
"""
        
        with open(self.project_root / '.dockerignore', 'w') as f:
            f.write(dockerignore_content)
        
        print("✅ Docker文件创建完成")
    
    def deploy(self):
        """执行部署"""
        print(f"🚀 开始部署到 {self.environment} 环境...")
        
        try:
            # 检查前提条件
            self.check_prerequisites()
            
            # 安装依赖
            self.install_dependencies()
            
            # 运行测试
            if self.environment != 'development':
                self.run_tests()
            
            # 设置数据库
            self.setup_database()
            
            # 构建静态资源
            self.build_static_assets()
            
            # 创建配置文件
            if self.environment == 'production':
                self.create_gunicorn_config()
                self.create_systemd_service()
                self.create_nginx_config()
            
            # 创建Docker文件
            self.create_docker_files()
            
            print("🎉 部署完成!")
            print(f"应用将在端口 {self.config['port']} 上运行")
            
            if self.environment == 'production':
                print("请完成以下步骤:")
                print("1. 修改Nginx配置中的域名和SSL证书路径")
                print("2. 启动服务: sudo systemctl start tetris-game")
                print("3. 重启Nginx: sudo systemctl restart nginx")
            
        except Exception as e:
            print(f"❌ 部署失败: {e}")
            sys.exit(1)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='俄罗斯方块游戏部署脚本')
    parser.add_argument(
        '--env', 
        choices=['development', 'testing', 'production', 'docker'],
        default='production',
        help='部署环境'
    )
    parser.add_argument(
        '--skip-tests',
        action='store_true',
        help='跳过测试'
    )
    
    args = parser.parse_args()
    
    # 创建部署管理器
    deployer = DeploymentManager(args.env)
    
    # 如果指定跳过测试，修改部署流程
    if args.skip_tests:
        original_run_tests = deployer.run_tests
        deployer.run_tests = lambda: print("⏭️  跳过测试")
    
    # 执行部署
    deployer.deploy()


if __name__ == '__main__':
    main()
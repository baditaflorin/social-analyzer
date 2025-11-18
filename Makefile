# Social Analyzer - Makefile
# Provides build, test, and deployment commands

.PHONY: help install test lint clean docker-build docker-run dev start stop

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Social Analyzer - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

test: ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	npm test

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(NC)"
	npm run test:unit

test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(NC)"
	npm run test:integration

test-security: ## Run security tests only
	@echo "$(BLUE)Running security tests...$(NC)"
	npm run test:security

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	npm test -- --watch

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

lint-fix: ## Run linter with auto-fix
	@echo "$(BLUE)Running linter with auto-fix...$(NC)"
	npm run lint -- --fix
	@echo "$(GREEN)✓ Linting complete$(NC)"

dev: ## Run in development mode with auto-reload
	@echo "$(BLUE)Starting development server...$(NC)"
	@echo "$(YELLOW)Access at: http://localhost:9005$(NC)"
	npm run dev

start: ## Start the application
	@echo "$(BLUE)Starting application...$(NC)"
	@echo "$(YELLOW)Access at: http://localhost:9005$(NC)"
	npm start

clean: ## Clean temporary files and logs
	@echo "$(BLUE)Cleaning temporary files...$(NC)"
	rm -rf logs/*.txt
	rm -rf node_modules/.cache
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-all: ## Clean all generated files including node_modules
	@echo "$(BLUE)Cleaning all generated files...$(NC)"
	rm -rf node_modules
	rm -rf logs/*.txt
	rm -rf coverage
	rm -rf .nyc_output
	@echo "$(GREEN)✓ Deep cleanup complete$(NC)"

docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t social-analyzer:latest .
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-run: ## Run Docker container
	@echo "$(BLUE)Starting Docker container...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Container started$(NC)"
	@echo "$(YELLOW)Access at: http://localhost:9005$(NC)"

docker-stop: ## Stop Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Container stopped$(NC)"

docker-logs: ## Show Docker container logs
	docker-compose logs -f

docker-shell: ## Open shell in Docker container
	docker-compose exec app sh

security-check: ## Run npm audit for security vulnerabilities
	@echo "$(BLUE)Checking for security vulnerabilities...$(NC)"
	npm audit

security-fix: ## Fix security vulnerabilities automatically
	@echo "$(BLUE)Fixing security vulnerabilities...$(NC)"
	npm audit fix
	@echo "$(GREEN)✓ Security fixes applied$(NC)"

validate-env: ## Validate environment configuration
	@echo "$(BLUE)Validating environment configuration...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)⚠ .env file not found. Creating from .env.example...$(NC)"; \
		cp .env.example .env; \
		echo "$(GREEN)✓ .env created. Please configure it before running.$(NC)"; \
	else \
		echo "$(GREEN)✓ .env file exists$(NC)"; \
	fi

setup: install validate-env ## Complete setup (install + env validation)
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Configure .env file with your settings"
	@echo "  2. Run 'make dev' to start development server"
	@echo "  3. Access test harness at: http://localhost:9005/test-harness.html"

coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm test -- --coverage
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

benchmark: ## Run performance benchmarks
	@echo "$(BLUE)Running benchmarks...$(NC)"
	@echo "$(YELLOW)Not implemented yet$(NC)"

deploy-check: lint test security-check ## Run all pre-deployment checks
	@echo "$(GREEN)✓ All deployment checks passed$(NC)"

# Health check
health: ## Check application health
	@echo "$(BLUE)Checking application health...$(NC)"
	@curl -f http://localhost:9005/get_settings > /dev/null 2>&1 && \
		echo "$(GREEN)✓ Application is healthy$(NC)" || \
		echo "$(RED)✗ Application is not responding$(NC)"

# Generate documentation
docs: ## Generate API documentation
	@echo "$(BLUE)Generating documentation...$(NC)"
	@echo "$(YELLOW)Documentation generation not implemented yet$(NC)"

# Show current configuration
config: ## Show current configuration (sanitized)
	@echo "$(BLUE)Current Configuration:$(NC)"
	@if [ -f .env ]; then \
		echo "$(GREEN)Environment variables:$(NC)"; \
		grep -v '^#' .env | grep -v '^$$' | sed 's/=.*/=****/'; \
	else \
		echo "$(YELLOW)No .env file found$(NC)"; \
	fi

# Database operations (for future use)
db-backup: ## Backup data files
	@echo "$(BLUE)Backing up data files...$(NC)"
	@mkdir -p backups
	@tar -czf backups/data-$(shell date +%Y%m%d-%H%M%S).tar.gz data/
	@echo "$(GREEN)✓ Data backed up to backups/$(NC)"

db-restore: ## Restore data files from latest backup
	@echo "$(BLUE)Restoring data files...$(NC)"
	@if [ -z "$$(ls -A backups/*.tar.gz 2>/dev/null)" ]; then \
		echo "$(RED)✗ No backup files found$(NC)"; \
		exit 1; \
	fi
	@LATEST=$$(ls -t backups/*.tar.gz | head -1); \
	tar -xzf $$LATEST; \
	echo "$(GREEN)✓ Data restored from $$LATEST$(NC)"

# Performance profiling
profile: ## Run application with profiling
	@echo "$(BLUE)Running with profiling...$(NC)"
	node --prof app.js --gui &
	@echo "$(YELLOW)Run your tests, then stop the server to generate profile$(NC)"

# Memory leak detection
memory-check: ## Check for memory leaks
	@echo "$(BLUE)Checking for memory leaks...$(NC)"
	node --expose-gc --inspect app.js --gui &
	@echo "$(YELLOW)Connect Chrome DevTools to inspect memory usage$(NC)"

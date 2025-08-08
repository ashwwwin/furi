# Python MCP Server Support for Furikake

This document outlines the implementation of Python MCP server support in Furikake CLI.

## Overview

Furikake now supports Python-based MCP (Model Context Protocol) servers in addition to the existing Node.js/TypeScript support. The implementation includes automatic detection, virtual environment setup, dependency installation, and transport wrapper creation for Python MCP servers.

## Features Implemented

### 1. Python Package Detection

The system automatically detects Python MCP servers by checking for:

- **Package Management Files**:
  - `requirements.txt` (pip)
  - `setup.py` (setuptools)
  - `pyproject.toml` (modern Python packaging)
  - `poetry.lock` (Poetry)
  - `Pipfile` (Pipenv)

- **Entry Point Detection**:
  - `main.py`
  - `app.py`
  - `server.py`
  - `mcp_server.py`
  - `__main__.py`
  - `src/main.py`
  - `src/app.py`
  - `src/server.py`

### 2. Virtual Environment Management

- **Automatic Virtual Environment Creation**: Creates `.venv` in the package directory
- **Python Version Detection**: Tries multiple Python executables (`python3`, `python`, `python3.11`, etc.)
- **Dependency Installation**: Supports multiple package managers:
  - pip (`requirements.txt`)
  - setuptools (`setup.py` with `pip install -e .`)
  - Poetry (`poetry install`)
  - Pipenv (`pipenv install`)
  - pyproject.toml (`pip install -e .`)

### 3. Transport Wrapper

Python MCP servers get a custom transport wrapper (`furi-transport-wrapper.py`) that:

- **Multi-connection Support**: Enables both stdio and Unix socket connections
- **Process Management**: Handles process lifecycle and cleanup
- **Signal Handling**: Proper SIGINT/SIGTERM handling
- **Error Handling**: Graceful error handling and logging
- **Threading**: Uses threading for concurrent socket handling

### 4. Environment Variable Detection

Enhanced environment variable scanning for Python files supports:

- **Standard Patterns**:
  - `os.environ.get("VAR_NAME")`
  - `os.environ["VAR_NAME"]`
  - `os.getenv("VAR_NAME")`

- **Configuration Patterns**:
  - `config("VAR_NAME")` (python-decouple/django-environ)
  - Pydantic Settings classes
  - Direct assignment from os.environ

- **Comment Support**: Detects environment variables mentioned in Python comments (`#`)

### 5. Package Type Prioritization

When both Python and Node.js files are present:
- Prioritizes Node.js if `package.json` exists
- Falls back to Python if only Python files are detected
- Provides clear feedback about package type selection

## File Structure Changes

### Modified Files

1. **`app/packages/add/actions/initializePackage.ts`**:
   - Added `detectPythonPackageType()` function
   - Added `getPythonExecutable()` function
   - Added `setupPythonEnvironment()` function
   - Added `createPythonTransportWrapper()` function
   - Added `initializePythonPackage()` function
   - Modified main package detection logic

2. **`app/mcp/env/actions/scanEnvVars.ts`**:
   - Added Python-specific regex patterns for environment variable detection
   - Added support for Python comment syntax (`#`)
   - Enhanced file scanning to include `.py` files (already supported)

3. **`README.md`**:
   - Updated to reflect Python MCP server support

## Configuration Schema

Python packages are stored in the configuration with additional metadata:

```json
{
  "installed": {
    "user/python-mcp": {
      "run": "/path/to/.venv/bin/python furi-transport-wrapper.py",
      "source": "/path/to/package",
      "socketPath": "/path/to/transport/socket",
      "originalRun": "python main.py",
      "transportWrapper": true,
      "packageType": "python",
      "pythonPath": "/path/to/.venv/bin/python",
      "venvPath": "/path/to/.venv"
    }
  }
}
```

## Usage Examples

### Adding a Python MCP Server

```bash
# Add a Python MCP server from GitHub
furi add user/python-mcp-server

# The system will:
# 1. Clone the repository
# 2. Detect it's a Python package
# 3. Create virtual environment
# 4. Install dependencies from requirements.txt/setup.py/etc.
# 5. Create transport wrapper
# 6. Register in configuration
```

### Smithery.yaml Support

Python MCP servers can specify run commands in `smithery.yaml`:

```yaml
commandFunction:
  run: "python -m my_mcp_server"

description: "My Python MCP Server"

configSchema:
  type: object
  properties:
    API_KEY:
      type: string
      description: "API key for the service"
  required:
    - API_KEY
```

### Environment Variable Detection

The system automatically detects environment variables from:

```python
# These patterns are automatically detected:
import os

API_KEY = os.environ.get("MY_API_KEY")
SECRET = os.getenv("MY_SECRET") 
CONFIG = os.environ["MY_CONFIG"]

# Using config libraries
from decouple import config
DATABASE_URL = config("DATABASE_URL")

# Pydantic settings
class Settings(BaseSettings):
    api_key: str = Field(...)  # MY_API_KEY detected
```

## Error Handling

The implementation includes comprehensive error handling:

- **Python Not Found**: Clear error messages if Python is not available
- **Virtual Environment Creation**: Fallback strategies for venv creation
- **Dependency Installation**: Detailed error messages with suggestions
- **Package Detection**: Graceful fallback between package types

## Testing

A test Python MCP server is included in `/test-python-mcp/` with:
- Simple MCP protocol implementation
- Environment variable usage examples
- Requirements.txt and smithery.yaml configuration

## Compatibility

- **Operating Systems**: Linux, macOS (Windows support with path adjustments)
- **Python Versions**: 3.8+ (tested with available Python executables)
- **Package Managers**: pip, Poetry, Pipenv, setuptools
- **MCP Protocol**: Compatible with existing MCP protocol standards

## Future Enhancements

Potential improvements for future versions:
- Python version pinning in configuration
- Conda environment support
- Enhanced Poetry integration
- Python-specific debugging tools
- Performance optimizations for large Python packages

## Migration

Existing Node.js MCP servers continue to work without changes. The system automatically detects package types and applies the appropriate initialization strategy.
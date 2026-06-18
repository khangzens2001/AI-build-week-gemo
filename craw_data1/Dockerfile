FROM python:3.11-slim

# Prevent python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Ensure data and logs directories exist and are writable
RUN mkdir -p data logs && chmod -R 777 data logs

# Default command: run the scraper in scheduler mode
CMD ["python", "main.py"]

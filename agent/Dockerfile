FROM python:3.11-slim

WORKDIR /app

# Install deps first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the source
COPY . .

EXPOSE 8001
# Note: do NOT use run.py (that's the Windows-only launcher)
CMD ["uvicorn", "server:server", "--host", "0.0.0.0", "--port", "8001"]

FROM python:3.11-slim
WORKDIR /app

# Prophet (CmdStan) için derleme araçları
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ cmake curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CmdStan'ı build sırasında derle — runtime'da Stan backend hazır olur
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan(progress=False)"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

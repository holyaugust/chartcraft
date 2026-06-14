FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# PPT Master（svg_to_pptx 等后处理脚本）
RUN git clone --depth 1 https://github.com/hugohe3/ppt-master.git /opt/ppt-master \
    && pip install --no-cache-dir -r /opt/ppt-master/requirements.txt

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PPT_MASTER_HOME=/opt/ppt-master
ENV PPT_MASTER_DATA_DIR=/data
ENV PPT_MASTER_API_HOST=0.0.0.0
ENV PPT_MASTER_API_PORT=8787

EXPOSE 8787

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787"]

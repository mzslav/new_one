FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY cors.inc /etc/nginx/conf.d/cors.inc

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

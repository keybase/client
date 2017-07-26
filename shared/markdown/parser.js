
    const linkExp = /^(:?\/\/)?(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}(?::[0-9]{1,6})?\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/=]*)/i
    const dotDotExp = /[^/]\.\.[^/]/
    const emojiExp = /\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc69|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc67|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc66|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc69|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc67|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc66|\ud83d\udc6e\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd3d\ud83c\udffb\u200d\u2640\ufe0f|\ud83e\udd39\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd39\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd39\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd39\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd39\ud83c\udffb\u200d\u2642\ufe0f|\ud83e\udd39\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd39\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd39\ud83c\udffd\u200d\u2640\ufe0f|\ud83e\udd39\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd39\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude4b\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude47\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude47\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude47\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udffb\u200d\u2642\ufe0f|\ud83e\udd38\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd38\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd38\ud83c\udffd\u200d\u2640\ufe0f|\ud83e\udd38\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd38\ud83c\udffb\u200d\u2640\ufe0f|\ud83e\udd37\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd37\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd37\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd37\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd37\ud83c\udffb\u200d\u2642\ufe0f|\ud83e\udd37\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd37\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd37\ud83c\udffd\u200d\u2640\ufe0f|\ud83e\udd37\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd37\ud83c\udffb\u200d\u2640\ufe0f|\ud83e\udd26\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd26\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd26\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd26\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd26\ud83c\udffb\u200d\u2642\ufe0f|\ud83e\udd26\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd26\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd26\ud83c\udffd\u200d\u2640\ufe0f|\ud83e\udd26\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd26\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udeb6\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udeb6\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udeb6\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udeb6\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udeb6\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udeb6\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udeb6\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udeb6\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udeb6\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udeb6\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udeb5\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udeb5\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udeb5\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udeb5\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udeb5\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udeb5\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udeb5\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udeb5\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udeb5\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udeb5\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udeb4\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udeb4\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udeb4\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udeb4\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udeb4\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udeb4\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude47\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude47\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude47\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude47\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udeb4\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udeb4\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udeb4\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udeb4\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udea3\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude47\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\ude47\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\ude47\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude46\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udea3\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude46\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude46\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude46\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude46\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udea3\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude46\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude46\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\ude46\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\ude46\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\ude46\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude45\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude45\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude45\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude45\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udea3\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udea3\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude4e\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude4e\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude4e\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude4e\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude4e\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude4e\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude4e\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\ude4e\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\ude4e\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\ude4e\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude4d\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude4d\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude4d\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude4d\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude4d\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude4d\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude4d\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\ude4d\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\ude4d\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\ude4d\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude4b\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude4b\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\ude45\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\ude45\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\ude45\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\ude45\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\ude45\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\ude45\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf73|\ud83d\udd75\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\ude4b\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udd75\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udd75\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udd75\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udd75\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf93|\ud83d\udd75\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udd75\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udd75\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udd75\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udd75\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc87\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc87\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc87\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc87\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc87\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc87\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc87\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc87\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc87\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc87\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc86\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc86\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc86\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc86\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc86\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc86\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc86\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc86\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc86\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc86\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc82\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc82\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc82\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc82\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc82\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc82\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc82\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc82\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc82\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc82\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc81\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc81\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc81\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc81\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc81\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc81\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc81\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc81\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc81\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc81\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc77\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc77\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc77\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc77\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc77\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc77\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc77\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc77\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc77\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc77\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc73\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc73\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc73\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc73\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc73\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc73\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc73\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc73\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc73\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc73\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc71\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc71\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udc71\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc71\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc71\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc71\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc71\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc71\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc71\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc71\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc6e\ud83c\udfff\u200d\u2642\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf93|\ud83d\udc6e\ud83c\udffd\u200d\u2642\ufe0f|\ud83d\udc6e\ud83c\udffc\u200d\u2642\ufe0f|\ud83d\udc6e\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc6e\ud83c\udfff\u200d\u2640\ufe0f|\ud83d\udc6e\ud83c\udffe\u200d\u2640\ufe0f|\ud83d\udc6e\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc6e\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc6e\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\ude4b\ud83c\udffc\u200d\u2640\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf3e|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf3e|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf3e|\ud83d\udc69\ud83c\udfff\u200d\u2708\ufe0f|\ud83d\udc69\ud83c\udffe\u200d\u2708\ufe0f|\ud83d\udc69\ud83c\udffd\u200d\u2708\ufe0f|\ud83d\udc69\ud83c\udffc\u200d\u2708\ufe0f|\ud83d\udc69\ud83c\udffb\u200d\u2708\ufe0f|\ud83d\udc69\ud83c\udfff\u200d\u2696\ufe0f|\ud83d\udc69\ud83c\udffe\u200d\u2696\ufe0f|\ud83d\udc69\ud83c\udffd\u200d\u2696\ufe0f|\ud83d\udc69\ud83c\udffc\u200d\u2696\ufe0f|\ud83d\udc69\ud83c\udffb\u200d\u2696\ufe0f|\ud83d\udc69\ud83c\udfff\u200d\u2695\ufe0f|\ud83d\udc69\ud83c\udffe\u200d\u2695\ufe0f|\ud83d\udc69\ud83c\udffd\u200d\u2695\ufe0f|\ud83d\udc69\ud83c\udffc\u200d\u2695\ufe0f|\ud83d\udc69\ud83c\udffb\u200d\u2695\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf3e|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf73|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf73|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf73|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf73|\ud83e\udd3e\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd3e\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd3e\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd3e\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd3e\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\u2708\ufe0f|\ud83d\udc68\ud83c\udffe\u200d\u2708\ufe0f|\ud83d\udc68\ud83c\udffd\u200d\u2708\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\u2708\ufe0f|\ud83d\udc68\ud83c\udffb\u200d\u2708\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\u2696\ufe0f|\ud83d\udc68\ud83c\udffe\u200d\u2696\ufe0f|\ud83d\udc68\ud83c\udffd\u200d\u2696\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\u2696\ufe0f|\ud83d\udc68\ud83c\udffb\u200d\u2696\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\u2695\ufe0f|\ud83d\udc68\ud83c\udffe\u200d\u2695\ufe0f|\ud83d\udc68\ud83c\udffd\u200d\u2695\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\u2695\ufe0f|\ud83d\udc68\ud83c\udffb\u200d\u2695\ufe0f|\ud83e\udd3e\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd3e\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd3e\ud83c\udffd\u200d\u2640\ufe0f|\ud83e\udd3e\ud83c\udffc\u200d\u2640\ufe0f|\ud83e\udd3e\ud83c\udffb\u200d\u2640\ufe0f|\ud83e\udd3d\ud83c\udfff\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udffe\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udffd\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udffc\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udffb\u200d\u2642\ufe0f|\ud83e\udd3d\ud83c\udfff\u200d\u2640\ufe0f|\ud83e\udd3d\ud83c\udffe\u200d\u2640\ufe0f|\ud83e\udd3d\ud83c\udffd\u200d\u2640\ufe0f|\ud83d\udc41\ufe0f\u200d\ud83d\udde8\ufe0f|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf93|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf93|\ud83c\udfcc\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfcc\ud83c\udffe\u200d\u2642\ufe0f|\ud83c\udfcc\ud83c\udffd\u200d\u2642\ufe0f|\ud83c\udfcc\ud83c\udffc\u200d\u2642\ufe0f|\ud83c\udfcc\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf93|\ud83c\udfcc\ud83c\udfff\u200d\u2640\ufe0f|\ud83c\udfcc\ud83c\udffe\u200d\u2640\ufe0f|\ud83c\udfcc\ud83c\udffd\u200d\u2640\ufe0f|\ud83c\udfcc\ud83c\udffc\u200d\u2640\ufe0f|\ud83c\udfcc\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfa4|\ud83c\udfcb\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfcb\ud83c\udffe\u200d\u2642\ufe0f|\ud83c\udfcb\ud83c\udffd\u200d\u2642\ufe0f|\ud83c\udfcb\ud83c\udffc\u200d\u2642\ufe0f|\ud83c\udfcb\ud83c\udffb\u200d\u2642\ufe0f|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfa4|\ud83c\udfcb\ud83c\udfff\u200d\u2640\ufe0f|\ud83c\udfcb\ud83c\udffe\u200d\u2640\ufe0f|\ud83c\udfcb\ud83c\udffd\u200d\u2640\ufe0f|\ud83c\udfcb\ud83c\udffc\u200d\u2640\ufe0f|\ud83c\udfcb\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfa4|\ud83c\udfca\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfca\ud83c\udffe\u200d\u2642\ufe0f|\ud83c\udfca\ud83c\udffd\u200d\u2642\ufe0f|\ud83c\udfca\ud83c\udffc\u200d\u2642\ufe0f|\ud83c\udfca\ud83c\udffb\u200d\u2642\ufe0f|\ud83c\udfca\ud83c\udfff\u200d\u2640\ufe0f|\ud83c\udfca\ud83c\udffe\u200d\u2640\ufe0f|\ud83c\udfca\ud83c\udffd\u200d\u2640\ufe0f|\ud83c\udfca\ud83c\udffc\u200d\u2640\ufe0f|\ud83c\udfca\ud83c\udffb\u200d\u2640\ufe0f|\ud83c\udfc4\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfc4\ud83c\udffe\u200d\u2642\ufe0f|\ud83c\udfc4\ud83c\udffd\u200d\u2642\ufe0f|\ud83c\udfc4\ud83c\udffc\u200d\u2642\ufe0f|\ud83c\udfc4\ud83c\udffb\u200d\u2642\ufe0f|\ud83c\udfc4\ud83c\udfff\u200d\u2640\ufe0f|\ud83c\udfc4\ud83c\udffe\u200d\u2640\ufe0f|\ud83c\udfc4\ud83c\udffd\u200d\u2640\ufe0f|\ud83c\udfc4\ud83c\udffc\u200d\u2640\ufe0f|\ud83c\udfc4\ud83c\udffb\u200d\u2640\ufe0f|\ud83c\udfc3\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfc3\ud83c\udffe\u200d\u2642\ufe0f|\ud83c\udfc3\ud83c\udffd\u200d\u2642\ufe0f|\ud83c\udfc3\ud83c\udffc\u200d\u2642\ufe0f|\ud83c\udfc3\ud83c\udffb\u200d\u2642\ufe0f|\ud83c\udfc3\ud83c\udfff\u200d\u2640\ufe0f|\ud83c\udfc3\ud83c\udffe\u200d\u2640\ufe0f|\ud83c\udfc3\ud83c\udffd\u200d\u2640\ufe0f|\ud83c\udfc3\ud83c\udffc\u200d\u2640\ufe0f|\ud83c\udfc3\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc69\ud83c\udfff\u200d\ud83d\ude92|\ud83d\udc69\ud83c\udffe\u200d\ud83d\ude92|\ud83d\udc69\ud83c\udffd\u200d\ud83d\ude92|\ud83d\udc69\ud83c\udffc\u200d\ud83d\ude92|\ud83d\udc69\ud83c\udffb\u200d\ud83d\ude92|\ud83d\udc69\ud83c\udfff\u200d\ud83d\ude80|\ud83d\udc69\ud83c\udffe\u200d\ud83d\ude80|\ud83d\udc69\ud83c\udffd\u200d\ud83d\ude80|\ud83d\udc69\ud83c\udffc\u200d\ud83d\ude80|\ud83d\udc69\ud83c\udffb\u200d\ud83d\ude80|\ud83d\udc69\ud83c\udfff\u200d\ud83d\udd2c|\ud83d\udc69\ud83c\udffe\u200d\ud83d\udd2c|\ud83d\udc69\ud83c\udffd\u200d\ud83d\udd2c|\ud83d\udc69\ud83c\udffc\u200d\ud83d\udd2c|\ud83d\udc69\ud83c\udffb\u200d\ud83d\udd2c|\ud83d\udc69\ud83c\udfff\u200d\ud83d\udd27|\ud83d\udc69\ud83c\udffe\u200d\ud83d\udd27|\ud83d\udc69\ud83c\udffd\u200d\ud83d\udd27|\ud83d\udc69\ud83c\udffc\u200d\ud83d\udd27|\ud83d\udc69\ud83c\udffb\u200d\ud83d\udd27|\ud83d\udc69\ud83c\udfff\u200d\ud83d\udcbc|\ud83d\udc69\ud83c\udffe\u200d\ud83d\udcbc|\ud83d\udc69\ud83c\udffd\u200d\ud83d\udcbc|\ud83d\udc69\ud83c\udffc\u200d\ud83d\udcbc|\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbc|\ud83d\udc69\ud83c\udfff\u200d\ud83d\udcbb|\ud83d\udc69\ud83c\udffe\u200d\ud83d\udcbb|\ud83d\udc69\ud83c\udffd\u200d\ud83d\udcbb|\ud83d\udc69\ud83c\udffc\u200d\ud83d\udcbb|\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbb|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfed|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfed|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfed|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfed|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfed|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfeb|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfeb|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfeb|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfeb|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfeb|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfa8|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfa8|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfa8|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfa8|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfa8|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfa4|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfa4|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfa4|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfa4|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfa4|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf93|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf93|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf93|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf93|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf93|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf73|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf73|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf73|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf73|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf73|\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf3e|\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf3e|\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf3e|\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf3e|\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf3e|\ud83d\udc68\ud83c\udfff\u200d\ud83d\ude92|\ud83d\udc68\ud83c\udffe\u200d\ud83d\ude92|\ud83d\udc68\ud83c\udffd\u200d\ud83d\ude92|\ud83d\udc68\ud83c\udffc\u200d\ud83d\ude92|\ud83d\udc68\ud83c\udffb\u200d\ud83d\ude92|\ud83d\udc68\ud83c\udfff\u200d\ud83d\ude80|\ud83d\udc68\ud83c\udffe\u200d\ud83d\ude80|\ud83d\udc68\ud83c\udffd\u200d\ud83d\ude80|\ud83d\udc68\ud83c\udffc\u200d\ud83d\ude80|\ud83d\udc68\ud83c\udffb\u200d\ud83d\ude80|\ud83d\udc68\ud83c\udfff\u200d\ud83d\udd2c|\ud83d\udc68\ud83c\udffe\u200d\ud83d\udd2c|\ud83d\udc68\ud83c\udffd\u200d\ud83d\udd2c|\ud83d\udc68\ud83c\udffc\u200d\ud83d\udd2c|\ud83d\udc68\ud83c\udffb\u200d\ud83d\udd2c|\ud83d\udc68\ud83c\udfff\u200d\ud83d\udd27|\ud83d\udc68\ud83c\udffe\u200d\ud83d\udd27|\ud83d\udc68\ud83c\udffd\u200d\ud83d\udd27|\ud83d\udc68\ud83c\udffc\u200d\ud83d\udd27|\ud83d\udc68\ud83c\udffb\u200d\ud83d\udd27|\ud83d\udc68\ud83c\udfff\u200d\ud83d\udcbc|\ud83d\udc68\ud83c\udffe\u200d\ud83d\udcbc|\ud83d\udc68\ud83c\udffd\u200d\ud83d\udcbc|\ud83d\udc68\ud83c\udffc\u200d\ud83d\udcbc|\ud83d\udc68\ud83c\udffb\u200d\ud83d\udcbc|\ud83d\udc68\ud83c\udfff\u200d\ud83d\udcbb|\ud83d\udc68\ud83c\udffe\u200d\ud83d\udcbb|\ud83d\udc68\ud83c\udffd\u200d\ud83d\udcbb|\ud83d\udc68\ud83c\udffc\u200d\ud83d\udcbb|\ud83d\udc68\ud83c\udffb\u200d\ud83d\udcbb|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfed|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfed|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfed|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfed|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfed|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfeb|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfeb|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfeb|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfeb|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfeb|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfa8|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfa8|\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfa8|\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfa8|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfa8|\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfa4|\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfa4|\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf3e|\u26f9\ud83c\udfff\u200d\u2642\ufe0f|\ud83c\udfcb\ufe0f\u200d\u2642\ufe0f|\ud83c\udfcc\ufe0f\u200d\u2640\ufe0f|\ud83c\udfcc\ufe0f\u200d\u2642\ufe0f|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\u26f9\ud83c\udffe\u200d\u2642\ufe0f|\ud83d\udd75\ufe0f\u200d\u2640\ufe0f|\ud83d\udd75\ufe0f\u200d\u2642\ufe0f|\ud83c\udfcb\ufe0f\u200d\u2640\ufe0f|\u26f9\ud83c\udffc\u200d\u2640\ufe0f|\u26f9\ud83c\udffd\u200d\u2640\ufe0f|\u26f9\ud83c\udffe\u200d\u2640\ufe0f|\u26f9\ud83c\udfff\u200d\u2640\ufe0f|\u26f9\ud83c\udffb\u200d\u2642\ufe0f|\u26f9\ud83c\udffc\u200d\u2642\ufe0f|\u26f9\ud83c\udffd\u200d\u2642\ufe0f|\u26f9\ud83c\udffb\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6e\u200d\u2642\ufe0f|\ud83e\udd38\u200d\u2640\ufe0f|\ud83c\udfc3\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83c\udf73|\ud83e\udd3d\u200d\u2640\ufe0f|\ud83d\udc81\u200d\u2642\ufe0f|\ud83e\udd38\u200d\u2642\ufe0f|\ud83d\ude4d\u200d\u2642\ufe0f|\ud83d\udc6e\u200d\u2640\ufe0f|\ud83d\udc69\u200d\ud83c\udf3e|\ud83c\udfc3\u200d\u2640\ufe0f|\ud83d\ude46\u200d\u2640\ufe0f|\ud83d\udeb6\u200d\u2640\ufe0f|\ud83e\udd26\u200d\u2642\ufe0f|\ud83d\udc81\u200d\u2640\ufe0f|\ud83d\udc68\u200d\ud83d\ude92|\ud83d\udeb4\u200d\u2640\ufe0f|\ud83d\udc69\u200d\ud83d\ude92|\ud83d\udc87\u200d\u2642\ufe0f|\u26f9\ufe0f\u200d\u2640\ufe0f|\ud83d\ude4d\u200d\u2640\ufe0f|\ud83d\udc68\u200d\ud83d\ude80|\ud83d\ude47\u200d\u2642\ufe0f|\ud83d\udc69\u200d\u2708\ufe0f|\ud83d\udc69\u200d\ud83d\ude80|\ud83d\udc77\u200d\u2642\ufe0f|\u26f9\ufe0f\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83d\udd2c|\ud83d\ude47\u200d\u2640\ufe0f|\ud83d\udc87\u200d\u2640\ufe0f|\ud83d\ude45\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83d\udd2c|\ud83d\udc69\u200d\u2696\ufe0f|\ud83d\udc68\u200d\ud83d\udd27|\ud83e\udd37\u200d\u2642\ufe0f|\ud83d\udc77\u200d\u2640\ufe0f|\ud83d\ude4b\u200d\u2642\ufe0f|\ud83d\udeb5\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83d\udd27|\ud83d\udc68\u200d\ud83d\udcbc|\ud83e\udd3e\u200d\u2640\ufe0f|\ud83d\udc69\u200d\u2695\ufe0f|\ud83d\udc86\u200d\u2642\ufe0f|\ud83e\udd26\u200d\u2640\ufe0f|\ud83d\udc73\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83d\udcbb|\ud83d\udc69\u200d\ud83d\udcbc|\ud83d\udea3\u200d\u2640\ufe0f|\ud83e\udd3e\u200d\u2642\ufe0f|\ud83d\ude4b\u200d\u2640\ufe0f|\ud83e\udd39\u200d\u2640\ufe0f|\ud83d\udc68\u200d\ud83d\udc67|\ud83d\udc68\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83c\udfed|\ud83d\udc86\u200d\u2640\ufe0f|\ud83d\udc69\u200d\ud83d\udcbb|\ud83d\udc73\u200d\u2640\ufe0f|\ud83d\udea3\u200d\u2642\ufe0f|\ud83e\udd3d\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83c\udfeb|\ud83d\ude45\u200d\u2640\ufe0f|\ud83c\udfca\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83d\udc67|\ud83d\udc69\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83c\udfed|\ud83d\udc68\u200d\ud83c\udfa8|\ud83d\udeb5\u200d\u2640\ufe0f|\ud83d\ude4e\u200d\u2642\ufe0f|\ud83d\udc71\u200d\u2642\ufe0f|\ud83d\udc68\u200d\u2708\ufe0f|\ud83d\udc82\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83c\udfa4|\ud83d\udc69\u200d\ud83c\udfeb|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83c\udfca\u200d\u2640\ufe0f|\ud83e\udd37\u200d\u2640\ufe0f|\ud83d\udeb6\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83c\udf93|\ud83d\ude46\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83c\udfa8|\ud83d\udc68\u200d\u2696\ufe0f|\ud83d\udc71\u200d\u2640\ufe0f|\ud83c\udfc4\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83c\udf73|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83d\udc82\u200d\u2640\ufe0f|\ud83d\udc69\u200d\ud83c\udfa4|\ud83d\ude4e\u200d\u2640\ufe0f|\ud83e\udd39\u200d\u2642\ufe0f|\ud83d\udc68\u200d\ud83c\udf3e|\ud83d\udc68\u200d\u2695\ufe0f|\ud83c\udfc4\u200d\u2640\ufe0f|\ud83d\udeb4\u200d\u2642\ufe0f|\ud83d\udc69\u200d\ud83c\udf93|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83d\udecc\ud83c\udffe|\ud83e\udd3d\ud83c\udffb|\ud83e\udd3d\ud83c\udffd|\ud83e\udd3d\ud83c\udffe|\ud83e\udd3d\ud83c\udfff|\ud83e\udd3e\ud83c\udffb|\ud83e\udd3e\ud83c\udffc|\ud83e\udd3e\ud83c\udffd|\ud83e\udd3e\ud83c\udffe|\ud83e\udd3e\ud83c\udfff|\ud83c\udf85\ud83c\udffb|\ud83c\udf85\ud83c\udffc|\ud83c\udf85\ud83c\udffd|\ud83c\udf85\ud83c\udffe|\ud83c\udf85\ud83c\udfff|\ud83c\udfc2\ud83c\udffb|\ud83c\udfc2\ud83c\udffc|\ud83c\udfc2\ud83c\udffd|\ud83c\udfc2\ud83c\udffe|\ud83c\udfc2\ud83c\udfff|\ud83c\udfc3\ud83c\udffb|\ud83c\udfc3\ud83c\udffc|\ud83c\udde6\ud83c\udde8|\ud83c\udde6\ud83c\udde9|\ud83c\udde6\ud83c\uddea|\ud83c\udde6\ud83c\uddeb|\ud83c\udde6\ud83c\uddec|\ud83c\udde6\ud83c\uddee|\ud83c\udde6\ud83c\uddf1|\ud83c\udde6\ud83c\uddf2|\ud83c\udde6\ud83c\uddf4|\ud83c\udde6\ud83c\uddf6|\ud83c\udde6\ud83c\uddf7|\ud83c\udde6\ud83c\uddf8|\ud83c\udde6\ud83c\uddf9|\ud83c\udde6\ud83c\uddfa|\ud83c\udde6\ud83c\uddfc|\ud83c\udde6\ud83c\uddfd|\ud83c\udde6\ud83c\uddff|\ud83c\udde7\ud83c\udde6|\ud83c\udde7\ud83c\udde7|\ud83c\udde7\ud83c\udde9|\ud83c\udde7\ud83c\uddea|\ud83c\udde7\ud83c\uddeb|\ud83c\udde7\ud83c\uddec|\ud83c\udde7\ud83c\udded|\ud83c\udde7\ud83c\uddee|\ud83c\udde7\ud83c\uddef|\ud83c\udde7\ud83c\uddf1|\ud83c\udde7\ud83c\uddf2|\ud83c\udde7\ud83c\uddf3|\ud83c\udde7\ud83c\uddf4|\ud83c\udde7\ud83c\uddf6|\ud83c\udde7\ud83c\uddf7|\ud83c\udde7\ud83c\uddf8|\ud83c\udde7\ud83c\uddf9|\ud83c\udde7\ud83c\uddfb|\ud83c\udde7\ud83c\uddfc|\ud83c\udde7\ud83c\uddfe|\ud83c\udde7\ud83c\uddff|\ud83c\udde8\ud83c\udde6|\ud83c\udde8\ud83c\udde8|\ud83c\udde8\ud83c\udde9|\ud83c\udde8\ud83c\uddeb|\ud83c\udde8\ud83c\uddec|\ud83c\udde8\ud83c\udded|\ud83c\udde8\ud83c\uddee|\ud83c\udde8\ud83c\uddf0|\ud83c\udde8\ud83c\uddf1|\ud83c\udde8\ud83c\uddf2|\ud83c\udde8\ud83c\uddf3|\ud83c\udde8\ud83c\uddf4|\ud83c\udde8\ud83c\uddf5|\ud83c\udde8\ud83c\uddf7|\ud83c\udde8\ud83c\uddfa|\ud83c\udde8\ud83c\uddfb|\ud83c\udde8\ud83c\uddfc|\ud83c\udde8\ud83c\uddfd|\ud83c\udde8\ud83c\uddfe|\ud83c\udde8\ud83c\uddff|\ud83c\udde9\ud83c\uddea|\ud83c\udde9\ud83c\uddec|\ud83c\udde9\ud83c\uddef|\ud83c\udde9\ud83c\uddf0|\ud83c\udde9\ud83c\uddf2|\ud83c\udde9\ud83c\uddf4|\ud83c\udde9\ud83c\uddff|\ud83c\uddea\ud83c\udde6|\ud83c\uddea\ud83c\udde8|\ud83c\uddea\ud83c\uddea|\ud83c\uddea\ud83c\uddec|\ud83c\uddea\ud83c\udded|\ud83c\uddea\ud83c\uddf7|\ud83c\uddea\ud83c\uddf8|\ud83c\uddea\ud83c\uddf9|\ud83c\uddea\ud83c\uddfa|\ud83c\uddeb\ud83c\uddee|\ud83c\uddeb\ud83c\uddef|\ud83c\uddeb\ud83c\uddf0|\ud83c\uddeb\ud83c\uddf2|\ud83c\uddeb\ud83c\uddf4|\ud83c\uddeb\ud83c\uddf7|\ud83c\uddec\ud83c\udde6|\ud83c\uddec\ud83c\udde7|\ud83c\uddec\ud83c\udde9|\ud83c\uddec\ud83c\uddea|\ud83c\uddec\ud83c\uddeb|\ud83c\uddec\ud83c\uddec|\ud83c\uddec\ud83c\udded|\ud83c\uddec\ud83c\uddee|\ud83c\uddec\ud83c\uddf1|\ud83c\uddec\ud83c\uddf2|\ud83c\uddec\ud83c\uddf3|\ud83c\uddec\ud83c\uddf5|\ud83c\uddec\ud83c\uddf6|\ud83c\uddec\ud83c\uddf7|\ud83c\uddec\ud83c\uddf8|\ud83c\uddec\ud83c\uddf9|\ud83c\uddec\ud83c\uddfa|\ud83c\uddec\ud83c\uddfc|\ud83c\uddec\ud83c\uddfe|\ud83c\udded\ud83c\uddf0|\ud83c\udded\ud83c\uddf2|\ud83c\udded\ud83c\uddf3|\ud83c\udded\ud83c\uddf7|\ud83c\udded\ud83c\uddf9|\ud83c\udded\ud83c\uddfa|\ud83c\uddee\ud83c\udde8|\ud83c\uddee\ud83c\udde9|\ud83c\uddee\ud83c\uddea|\ud83c\uddee\ud83c\uddf1|\ud83c\uddee\ud83c\uddf2|\ud83c\uddee\ud83c\uddf3|\ud83c\uddee\ud83c\uddf4|\ud83c\uddee\ud83c\uddf6|\ud83c\uddee\ud83c\uddf7|\ud83c\uddee\ud83c\uddf8|\ud83c\uddee\ud83c\uddf9|\ud83c\uddef\ud83c\uddea|\ud83c\uddef\ud83c\uddf2|\ud83c\uddef\ud83c\uddf4|\ud83c\uddef\ud83c\uddf5|\ud83c\uddf0\ud83c\uddea|\ud83c\uddf0\ud83c\uddec|\ud83c\uddf0\ud83c\udded|\ud83c\uddf0\ud83c\uddee|\ud83c\uddf0\ud83c\uddf2|\ud83c\uddf0\ud83c\uddf3|\ud83c\uddf0\ud83c\uddf5|\ud83c\uddf0\ud83c\uddf7|\ud83c\uddf0\ud83c\uddfc|\ud83c\uddf0\ud83c\uddfe|\ud83c\uddf0\ud83c\uddff|\ud83c\uddf1\ud83c\udde6|\ud83c\uddf1\ud83c\udde7|\ud83c\uddf1\ud83c\udde8|\ud83c\uddf1\ud83c\uddee|\ud83c\uddf1\ud83c\uddf0|\ud83c\uddf1\ud83c\uddf7|\ud83c\uddf1\ud83c\uddf8|\ud83c\uddf1\ud83c\uddf9|\ud83c\uddf1\ud83c\uddfa|\ud83c\uddf1\ud83c\uddfb|\ud83c\uddf1\ud83c\uddfe|\ud83c\uddf2\ud83c\udde6|\ud83c\uddf2\ud83c\udde8|\ud83c\uddf2\ud83c\udde9|\ud83c\uddf2\ud83c\uddea|\ud83c\uddf2\ud83c\uddeb|\ud83c\uddf2\ud83c\uddec|\ud83c\uddf2\ud83c\udded|\ud83c\uddf2\ud83c\uddf0|\ud83c\uddf2\ud83c\uddf1|\ud83c\uddf2\ud83c\uddf2|\ud83c\uddf2\ud83c\uddf3|\ud83c\uddf2\ud83c\uddf4|\ud83c\uddf2\ud83c\uddf5|\ud83c\uddf2\ud83c\uddf6|\ud83c\uddf2\ud83c\uddf7|\ud83c\uddf2\ud83c\uddf8|\ud83c\uddf2\ud83c\uddf9|\ud83c\uddf2\ud83c\uddfa|\ud83c\uddf2\ud83c\uddfb|\ud83c\uddf2\ud83c\uddfc|\ud83c\uddf2\ud83c\uddfd|\ud83c\uddf2\ud83c\uddfe|\ud83c\uddf2\ud83c\uddff|\ud83c\uddf3\ud83c\udde6|\ud83c\uddf3\ud83c\udde8|\ud83c\uddf3\ud83c\uddea|\ud83c\uddf3\ud83c\uddeb|\ud83c\uddf3\ud83c\uddec|\ud83c\uddf3\ud83c\uddee|\ud83c\uddf3\ud83c\uddf1|\ud83c\uddf3\ud83c\uddf4|\ud83c\uddf3\ud83c\uddf5|\ud83c\uddf3\ud83c\uddf7|\ud83c\uddf3\ud83c\uddfa|\ud83c\uddf3\ud83c\uddff|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c\udde6|\ud83c\uddf5\ud83c\uddea|\ud83c\uddf5\ud83c\uddeb|\ud83c\uddf5\ud83c\uddec|\ud83c\uddf5\ud83c\udded|\ud83c\uddf5\ud83c\uddf0|\ud83c\uddf5\ud83c\uddf1|\ud83c\uddf5\ud83c\uddf2|\ud83c\uddf5\ud83c\uddf3|\ud83c\uddf5\ud83c\uddf7|\ud83c\uddf5\ud83c\uddf8|\ud83c\uddf5\ud83c\uddf9|\ud83c\uddf5\ud83c\uddfc|\ud83c\uddf5\ud83c\uddfe|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c\uddea|\ud83c\uddf7\ud83c\uddf4|\ud83c\uddf7\ud83c\uddf8|\ud83c\uddf7\ud83c\uddfa|\ud83c\uddf7\ud83c\uddfc|\ud83c\uddf8\ud83c\udde6|\ud83c\uddf8\ud83c\udde7|\ud83c\uddf8\ud83c\udde8|\ud83c\uddf8\ud83c\udde9|\ud83c\uddf8\ud83c\uddea|\ud83c\uddf8\ud83c\uddec|\ud83c\uddf8\ud83c\udded|\ud83c\uddf8\ud83c\uddee|\ud83c\uddf8\ud83c\uddef|\ud83c\uddf8\ud83c\uddf0|\ud83c\uddf8\ud83c\uddf1|\ud83c\uddf8\ud83c\uddf2|\ud83c\uddf8\ud83c\uddf3|\ud83c\uddf8\ud83c\uddf4|\ud83c\uddf8\ud83c\uddf7|\ud83c\uddf8\ud83c\uddf8|\ud83c\uddf8\ud83c\uddf9|\ud83c\uddf8\ud83c\uddfb|\ud83c\uddf8\ud83c\uddfd|\ud83c\uddf8\ud83c\uddfe|\ud83c\uddf8\ud83c\uddff|\ud83c\uddf9\ud83c\udde6|\ud83c\uddf9\ud83c\udde8|\ud83c\uddf9\ud83c\udde9|\ud83c\uddf9\ud83c\uddeb|\ud83c\uddf9\ud83c\uddec|\ud83c\uddf9\ud83c\udded|\ud83c\uddf9\ud83c\uddef|\ud83c\uddf9\ud83c\uddf0|\ud83c\uddf9\ud83c\uddf1|\ud83c\uddf9\ud83c\uddf2|\ud83c\uddf9\ud83c\uddf3|\ud83c\uddf9\ud83c\uddf4|\ud83c\uddf9\ud83c\uddf7|\ud83c\uddf9\ud83c\uddf9|\ud83c\uddf9\ud83c\uddfb|\ud83c\uddf9\ud83c\uddfc|\ud83c\uddf9\ud83c\uddff|\ud83c\uddfa\ud83c\udde6|\ud83c\uddfa\ud83c\uddec|\ud83c\uddfa\ud83c\uddf2|\ud83c\uddfa\ud83c\uddf3|\ud83c\uddfa\ud83c\uddf8|\ud83c\uddfa\ud83c\uddfe|\ud83c\uddfa\ud83c\uddff|\ud83c\uddfb\ud83c\udde6|\ud83c\uddfb\ud83c\udde8|\ud83c\uddfb\ud83c\uddea|\ud83c\uddfb\ud83c\uddec|\ud83c\uddfb\ud83c\uddee|\ud83c\uddfb\ud83c\uddf3|\ud83c\uddfb\ud83c\uddfa|\ud83c\uddfc\ud83c\uddeb|\ud83c\uddfc\ud83c\uddf8|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c\uddea|\ud83c\uddfe\ud83c\uddf9|\ud83c\uddff\ud83c\udde6|\ud83c\uddff\ud83c\uddf2|\ud83c\uddff\ud83c\uddfc|\ud83e\udd39\ud83c\udfff|\ud83e\udd39\ud83c\udffe|\ud83e\udd39\ud83c\udffd|\ud83e\udd39\ud83c\udffc|\ud83e\udd39\ud83c\udffb|\ud83e\udd38\ud83c\udfff|\ud83e\udd38\ud83c\udffe|\ud83e\udd38\ud83c\udffd|\ud83e\udd38\ud83c\udffc|\ud83e\udd38\ud83c\udffb|\ud83e\udd37\ud83c\udfff|\ud83e\udd37\ud83c\udffe|\ud83e\udd37\ud83c\udffd|\ud83e\udd37\ud83c\udffc|\ud83e\udd37\ud83c\udffb|\ud83e\udd36\ud83c\udfff|\ud83e\udd36\ud83c\udffe|\ud83e\udd36\ud83c\udffd|\ud83e\udd36\ud83c\udffc|\ud83e\udd36\ud83c\udffb|\ud83e\udd35\ud83c\udfff|\ud83e\udd35\ud83c\udffe|\ud83e\udd35\ud83c\udffd|\ud83e\udd35\ud83c\udffc|\ud83e\udd35\ud83c\udffb|\ud83e\udd34\ud83c\udfff|\ud83e\udd34\ud83c\udffe|\ud83e\udd34\ud83c\udffd|\ud83e\udd34\ud83c\udffc|\ud83e\udd34\ud83c\udffb|\ud83e\udd33\ud83c\udfff|\ud83e\udd33\ud83c\udffe|\ud83e\udd33\ud83c\udffd|\ud83e\udd33\ud83c\udffc|\ud83e\udd33\ud83c\udffb|\ud83e\udd30\ud83c\udfff|\ud83e\udd30\ud83c\udffe|\ud83e\udd30\ud83c\udffd|\ud83e\udd30\ud83c\udffc|\ud83e\udd30\ud83c\udffb|\ud83e\udd26\ud83c\udfff|\ud83e\udd26\ud83c\udffe|\ud83e\udd26\ud83c\udffd|\ud83e\udd26\ud83c\udffc|\ud83e\udd26\ud83c\udffb|\ud83e\udd1e\ud83c\udfff|\ud83e\udd1e\ud83c\udffe|\ud83e\udd1e\ud83c\udffd|\ud83e\udd1e\ud83c\udffc|\ud83e\udd1e\ud83c\udffb|\ud83e\udd1c\ud83c\udfff|\ud83e\udd1c\ud83c\udffe|\ud83e\udd1c\ud83c\udffd|\ud83e\udd1c\ud83c\udffc|\ud83e\udd1c\ud83c\udffb|\ud83e\udd1b\ud83c\udfff|\ud83e\udd1b\ud83c\udffe|\ud83e\udd1b\ud83c\udffd|\ud83e\udd1b\ud83c\udffc|\ud83e\udd1b\ud83c\udffb|\ud83e\udd1a\ud83c\udfff|\ud83e\udd1a\ud83c\udffe|\ud83e\udd1a\ud83c\udffd|\ud83e\udd1a\ud83c\udffc|\ud83e\udd1a\ud83c\udffb|\ud83e\udd19\ud83c\udfff|\ud83e\udd19\ud83c\udffe|\ud83e\udd19\ud83c\udffd|\ud83e\udd19\ud83c\udffc|\ud83e\udd19\ud83c\udffb|\ud83e\udd18\ud83c\udfff|\ud83e\udd18\ud83c\udffe|\ud83e\udd18\ud83c\udffd|\ud83e\udd18\ud83c\udffc|\ud83e\udd18\ud83c\udffb|\ud83d\udecc\ud83c\udfff|\ud83e\udd3d\ud83c\udffc|\ud83d\udecc\ud83c\udffd|\ud83d\udecc\ud83c\udffc|\ud83d\udecc\ud83c\udffb|\ud83d\udec0\ud83c\udfff|\ud83d\udec0\ud83c\udffe|\ud83d\udec0\ud83c\udffd|\ud83d\udec0\ud83c\udffc|\ud83d\udec0\ud83c\udffb|\ud83d\udeb6\ud83c\udfff|\ud83d\udeb6\ud83c\udffe|\ud83d\udeb6\ud83c\udffd|\ud83d\udeb6\ud83c\udffc|\ud83d\udeb6\ud83c\udffb|\ud83d\udeb5\ud83c\udfff|\ud83d\udeb5\ud83c\udffe|\ud83d\udeb5\ud83c\udffd|\ud83d\udeb5\ud83c\udffc|\ud83d\udeb5\ud83c\udffb|\ud83d\udeb4\ud83c\udfff|\ud83d\udeb4\ud83c\udffe|\ud83d\udeb4\ud83c\udffd|\ud83d\udeb4\ud83c\udffc|\ud83d\udeb4\ud83c\udffb|\ud83d\udea3\ud83c\udfff|\ud83d\udea3\ud83c\udffe|\ud83d\udea3\ud83c\udffd|\ud83d\udea3\ud83c\udffc|\ud83d\udea3\ud83c\udffb|\ud83d\ude4f\ud83c\udfff|\ud83d\ude4f\ud83c\udffe|\ud83d\ude4f\ud83c\udffd|\ud83d\ude4f\ud83c\udffc|\ud83d\ude4f\ud83c\udffb|\ud83d\ude4e\ud83c\udfff|\ud83d\ude4e\ud83c\udffe|\ud83d\ude4e\ud83c\udffd|\ud83d\ude4e\ud83c\udffc|\ud83d\ude4e\ud83c\udffb|\ud83d\ude4d\ud83c\udfff|\ud83d\ude4d\ud83c\udffe|\ud83d\ude4d\ud83c\udffd|\ud83d\ude4d\ud83c\udffc|\ud83d\ude4d\ud83c\udffb|\ud83d\ude4c\ud83c\udfff|\ud83d\ude4c\ud83c\udffe|\ud83d\ude4c\ud83c\udffd|\ud83d\ude4c\ud83c\udffc|\ud83d\ude4c\ud83c\udffb|\ud83d\ude4b\ud83c\udfff|\ud83d\ude4b\ud83c\udffe|\ud83d\ude4b\ud83c\udffd|\ud83d\ude4b\ud83c\udffc|\ud83d\ude4b\ud83c\udffb|\ud83d\ude47\ud83c\udfff|\ud83d\ude47\ud83c\udffe|\ud83d\ude47\ud83c\udffd|\ud83d\ude47\ud83c\udffc|\ud83d\ude47\ud83c\udffb|\ud83d\ude46\ud83c\udfff|\ud83d\ude46\ud83c\udffe|\ud83d\ude46\ud83c\udffd|\ud83d\ude46\ud83c\udffc|\ud83d\ude46\ud83c\udffb|\ud83d\ude45\ud83c\udfff|\ud83d\ude45\ud83c\udffe|\ud83d\ude45\ud83c\udffd|\ud83d\ude45\ud83c\udffc|\ud83d\ude45\ud83c\udffb|\ud83d\udd96\ud83c\udfff|\ud83d\udd96\ud83c\udffe|\ud83d\udd96\ud83c\udffd|\ud83d\udd96\ud83c\udffc|\ud83d\udd96\ud83c\udffb|\ud83d\udd95\ud83c\udfff|\ud83d\udd95\ud83c\udffe|\ud83d\udd95\ud83c\udffd|\ud83d\udd95\ud83c\udffc|\ud83d\udd95\ud83c\udffb|\ud83d\udd90\ud83c\udfff|\ud83d\udd90\ud83c\udffe|\ud83d\udd90\ud83c\udffd|\ud83d\udd90\ud83c\udffc|\ud83d\udd90\ud83c\udffb|\ud83d\udd7a\ud83c\udfff|\ud83d\udd7a\ud83c\udffe|\ud83d\udd7a\ud83c\udffd|\ud83d\udd7a\ud83c\udffc|\ud83d\udd7a\ud83c\udffb|\ud83c\udfc3\ud83c\udffd|\ud83d\udd75\ud83c\udfff|\ud83d\udd75\ud83c\udffe|\ud83d\udd75\ud83c\udffd|\ud83d\udd75\ud83c\udffc|\ud83d\udd75\ud83c\udffb|\ud83d\udd74\ud83c\udfff|\ud83d\udd74\ud83c\udffe|\ud83d\udd74\ud83c\udffd|\ud83d\udd74\ud83c\udffc|\ud83d\udd74\ud83c\udffb|\ud83d\udcaa\ud83c\udfff|\ud83d\udcaa\ud83c\udffe|\ud83d\udcaa\ud83c\udffd|\ud83d\udcaa\ud83c\udffc|\ud83d\udcaa\ud83c\udffb|\ud83d\udc87\ud83c\udfff|\ud83d\udc87\ud83c\udffe|\ud83d\udc87\ud83c\udffd|\ud83d\udc87\ud83c\udffc|\ud83d\udc87\ud83c\udffb|\ud83d\udc86\ud83c\udfff|\ud83d\udc86\ud83c\udffe|\ud83d\udc86\ud83c\udffd|\ud83d\udc86\ud83c\udffc|\ud83d\udc86\ud83c\udffb|\ud83d\udc85\ud83c\udfff|\ud83d\udc85\ud83c\udffe|\ud83d\udc85\ud83c\udffd|\ud83d\udc85\ud83c\udffc|\ud83d\udc83\ud83c\udfff|\ud83d\udc83\ud83c\udffe|\ud83d\udc83\ud83c\udffd|\ud83d\udc83\ud83c\udffc|\ud83d\udc83\ud83c\udffb|\ud83d\udc82\ud83c\udfff|\ud83d\udc82\ud83c\udffe|\ud83d\udc82\ud83c\udffd|\ud83d\udc82\ud83c\udffc|\ud83d\udc82\ud83c\udffb|\ud83d\udc81\ud83c\udfff|\ud83d\udc81\ud83c\udffe|\ud83d\udc81\ud83c\udffd|\ud83d\udc81\ud83c\udffc|\ud83d\udc81\ud83c\udffb|\ud83d\udc7c\ud83c\udfff|\ud83d\udc7c\ud83c\udffe|\ud83d\udc7c\ud83c\udffd|\ud83d\udc7c\ud83c\udffc|\ud83d\udc7c\ud83c\udffb|\ud83d\udc78\ud83c\udfff|\ud83d\udc78\ud83c\udffe|\ud83d\udc78\ud83c\udffd|\ud83d\udc78\ud83c\udffc|\ud83d\udc78\ud83c\udffb|\ud83d\udc77\ud83c\udfff|\ud83d\udc77\ud83c\udffe|\ud83d\udc77\ud83c\udffd|\ud83d\udc77\ud83c\udffc|\ud83d\udc77\ud83c\udffb|\ud83d\udc76\ud83c\udfff|\ud83d\udc76\ud83c\udffe|\ud83d\udc76\ud83c\udffd|\ud83d\udc76\ud83c\udffc|\ud83d\udc76\ud83c\udffb|\ud83d\udc75\ud83c\udfff|\ud83d\udc75\ud83c\udffe|\ud83d\udc75\ud83c\udffd|\ud83d\udc75\ud83c\udffc|\ud83d\udc75\ud83c\udffb|\ud83d\udc74\ud83c\udfff|\ud83d\udc74\ud83c\udffe|\ud83d\udc74\ud83c\udffd|\ud83d\udc74\ud83c\udffc|\ud83d\udc74\ud83c\udffb|\ud83d\udc73\ud83c\udfff|\ud83d\udc73\ud83c\udffe|\ud83d\udc73\ud83c\udffd|\ud83d\udc73\ud83c\udffc|\ud83d\udc73\ud83c\udffb|\ud83d\udc72\ud83c\udfff|\ud83d\udc72\ud83c\udffe|\ud83d\udc72\ud83c\udffd|\ud83d\udc72\ud83c\udffc|\ud83d\udc72\ud83c\udffb|\ud83d\udc71\ud83c\udfff|\ud83d\udc71\ud83c\udffe|\ud83d\udc71\ud83c\udffd|\ud83d\udc71\ud83c\udffc|\ud83d\udc71\ud83c\udffb|\ud83d\udc70\ud83c\udfff|\ud83d\udc70\ud83c\udffe|\ud83d\udc70\ud83c\udffd|\ud83d\udc70\ud83c\udffc|\ud83d\udc70\ud83c\udffb|\ud83d\udc6e\ud83c\udfff|\ud83d\udc6e\ud83c\udffe|\ud83d\udc6e\ud83c\udffd|\ud83d\udc6e\ud83c\udffc|\ud83d\udc6e\ud83c\udffb|\ud83d\udc69\ud83c\udfff|\ud83d\udc69\ud83c\udffe|\ud83d\udc69\ud83c\udffd|\ud83d\udc69\ud83c\udffc|\ud83d\udc69\ud83c\udffb|\ud83d\udc68\ud83c\udfff|\ud83d\udc68\ud83c\udffe|\ud83d\udc68\ud83c\udffd|\ud83d\udc68\ud83c\udffc|\ud83d\udc68\ud83c\udffb|\ud83d\udc67\ud83c\udfff|\ud83d\udc67\ud83c\udffe|\ud83d\udc67\ud83c\udffd|\ud83d\udc67\ud83c\udffc|\ud83d\udc67\ud83c\udffb|\ud83d\udc66\ud83c\udfff|\ud83d\udc66\ud83c\udffe|\ud83d\udc66\ud83c\udffd|\ud83d\udc66\ud83c\udffc|\ud83d\udc66\ud83c\udffb|\ud83d\udc50\ud83c\udfff|\ud83d\udc50\ud83c\udffe|\ud83d\udc50\ud83c\udffd|\ud83d\udc50\ud83c\udffc|\ud83d\udc50\ud83c\udffb|\ud83d\udc4f\ud83c\udfff|\ud83d\udc4f\ud83c\udffe|\ud83d\udc4f\ud83c\udffd|\ud83d\udc4f\ud83c\udffc|\ud83d\udc4f\ud83c\udffb|\ud83d\udc4e\ud83c\udfff|\ud83d\udc4e\ud83c\udffe|\ud83d\udc4e\ud83c\udffd|\ud83d\udc4e\ud83c\udffc|\ud83d\udc4e\ud83c\udffb|\ud83d\udc4d\ud83c\udfff|\ud83d\udc4d\ud83c\udffe|\ud83d\udc4d\ud83c\udffd|\ud83d\udc4d\ud83c\udffc|\ud83d\udc4d\ud83c\udffb|\ud83d\udc4c\ud83c\udfff|\ud83d\udc4c\ud83c\udffe|\ud83d\udc4c\ud83c\udffd|\ud83d\udc4c\ud83c\udffc|\ud83d\udc4c\ud83c\udffb|\ud83d\udc4b\ud83c\udfff|\ud83d\udc4b\ud83c\udffe|\ud83d\udc4b\ud83c\udffd|\ud83d\udc4b\ud83c\udffc|\ud83d\udc4b\ud83c\udffb|\ud83d\udc4a\ud83c\udfff|\ud83d\udc4a\ud83c\udffe|\ud83d\udc4a\ud83c\udffd|\ud83d\udc4a\ud83c\udffc|\ud83d\udc4a\ud83c\udffb|\ud83d\udc49\ud83c\udfff|\ud83d\udc49\ud83c\udffe|\ud83d\udc49\ud83c\udffd|\ud83d\udc49\ud83c\udffc|\ud83d\udc49\ud83c\udffb|\ud83d\udc48\ud83c\udfff|\ud83d\udc48\ud83c\udffe|\ud83d\udc48\ud83c\udffd|\ud83d\udc48\ud83c\udffc|\ud83d\udc48\ud83c\udffb|\ud83d\udc47\ud83c\udfff|\ud83d\udc47\ud83c\udffe|\ud83d\udc47\ud83c\udffd|\ud83d\udc47\ud83c\udffc|\ud83d\udc47\ud83c\udffb|\ud83d\udc46\ud83c\udfff|\ud83d\udc46\ud83c\udffe|\ud83d\udc46\ud83c\udffd|\ud83d\udc46\ud83c\udffc|\ud83d\udc46\ud83c\udffb|\ud83d\udc43\ud83c\udfff|\ud83d\udc43\ud83c\udffe|\ud83d\udc43\ud83c\udffd|\ud83d\udc43\ud83c\udffc|\ud83d\udc43\ud83c\udffb|\ud83d\udc42\ud83c\udfff|\ud83d\udc42\ud83c\udffe|\ud83d\udc42\ud83c\udffd|\ud83d\udc42\ud83c\udffc|\ud83d\udc42\ud83c\udffb|\ud83c\udfc3\ud83c\udffe|\ud83c\udfc3\ud83c\udfff|\ud83c\udfcc\ud83c\udfff|\ud83c\udfcc\ud83c\udffe|\ud83c\udfcc\ud83c\udffd|\ud83c\udfcc\ud83c\udffc|\ud83c\udfcc\ud83c\udffb|\ud83c\udfc4\ud83c\udffb|\ud83c\udfcb\ud83c\udfff|\ud83c\udfcb\ud83c\udffe|\ud83c\udfcb\ud83c\udffd|\ud83c\udfcb\ud83c\udffc|\ud83c\udfcb\ud83c\udffb|\ud83c\udfca\ud83c\udfff|\ud83c\udfca\ud83c\udffe|\ud83c\udfca\ud83c\udffd|\ud83c\udfca\ud83c\udffc|\ud83c\udfca\ud83c\udffb|\ud83c\udfc7\ud83c\udfff|\ud83c\udfc7\ud83c\udffe|\ud83c\udfc7\ud83c\udffd|\ud83c\udfc7\ud83c\udffc|\ud83c\udfc7\ud83c\udffb|\ud83c\udfc4\ud83c\udfff|\ud83c\udfc4\ud83c\udffe|\ud83c\udfc4\ud83c\udffd|\ud83c\udfc4\ud83c\udffc|\ud83d\udc85\ud83c\udffb|\ud83c\udfcb\ufe0f|\ud83c\udff3\ufe0f|\ud83d\udd75\ufe0f|\u0039\ufe0f\u20e3|\u0038\ufe0f\u20e3|\u0037\ufe0f\u20e3|\u0036\ufe0f\u20e3|\u0035\ufe0f\u20e3|\u0034\ufe0f\u20e3|\u0033\ufe0f\u20e3|\u0032\ufe0f\u20e3|\u0031\ufe0f\u20e3|\u0030\ufe0f\u20e3|\u002a\ufe0f\u20e3|\u0023\ufe0f\u20e3|\ud83c\ude37\ufe0f|\ud83c\ude2f\ufe0f|\ud83c\ude1a\ufe0f|\ud83c\ude02\ufe0f|\ud83c\udd7f\ufe0f|\ud83c\udd7e\ufe0f|\ud83c\udd71\ufe0f|\ud83c\udd70\ufe0f|\ud83c\udc04\ufe0f|\u270d\ud83c\udfff|\u270d\ud83c\udffe|\u270d\ud83c\udffd|\ud83c\udfcc\ufe0f|\u270d\ud83c\udffb|\u270c\ud83c\udfff|\u270c\ud83c\udffe|\u270c\ud83c\udffd|\u270c\ud83c\udffc|\u270c\ud83c\udffb|\u270b\ud83c\udfff|\u270b\ud83c\udffe|\u270b\ud83c\udffd|\u270b\ud83c\udffc|\u270b\ud83c\udffb|\u270a\ud83c\udfff|\u270a\ud83c\udffe|\u270a\ud83c\udffd|\u270a\ud83c\udffc|\u270a\ud83c\udffb|\u26f9\ud83c\udfff|\u26f9\ud83c\udffe|\u26f9\ud83c\udffd|\u26f9\ud83c\udffc|\u26f9\ud83c\udffb|\u261d\ud83c\udfff|\u261d\ud83c\udffe|\u261d\ud83c\udffd|\u261d\ud83c\udffc|\u261d\ud83c\udffb|\u270d\ud83c\udffc|\ud83d\ude43|\ud83d\ude44|\ud83c\udf61|\ud83c\udf62|\ud83c\udf63|\ud83c\udf64|\ud83c\udf65|\ud83d\ude45|\ud83c\udf66|\ud83c\udf67|\ud83c\udf68|\ud83c\udf69|\ud83c\udf6a|\ud83d\ude46|\ud83c\udf6b|\ud83c\udf6c|\ud83c\udf6d|\ud83c\udf6e|\ud83c\udf6f|\ud83d\ude47|\ud83d\ude48|\ud83d\ude49|\ud83d\ude4a|\ud83c\udf70|\ud83c\udf71|\ud83c\udf72|\ud83c\udf73|\ud83c\udf74|\ud83d\ude4b|\ud83c\udf75|\ud83c\udf76|\ud83c\udf77|\ud83c\udf78|\ud83c\udf79|\ud83d\ude4c|\ud83c\udf7a|\ud83c\udf7b|\ud83c\udf7c|\ud83c\udf7d|\ud83c\udf7e|\ud83d\ude4d|\ud83c\udf7f|\ud83c\udf80|\ud83c\udf81|\ud83c\udf82|\ud83c\udf83|\ud83d\ude4e|\ud83c\udf84|\u26f5\ufe0f|\u264a\ufe0f|\u2602\ufe0f|\u264b\ufe0f|\ud83d\ude4f|\ud83d\ude80|\ud83d\ude81|\ud83d\ude82|\ud83d\ude83|\ud83d\ude84|\ud83d\ude85|\ud83d\ude86|\ud83d\ude87|\ud83d\ude88|\ud83d\ude89|\ud83d\ude8a|\ud83d\ude8b|\ud83d\ude8c|\ud83d\ude8d|\ud83d\ude8e|\ud83d\ude8f|\ud83d\ude90|\ud83d\ude91|\ud83d\ude92|\ud83d\ude93|\ud83d\ude94|\ud83d\ude95|\ud83d\ude96|\ud83d\ude97|\ud83d\ude98|\ud83d\ude99|\ud83d\ude9a|\ud83d\ude9b|\ud83d\ude9c|\ud83d\ude9d|\ud83d\ude9e|\ud83d\ude9f|\ud83d\udea0|\ud83d\udea1|\ud83d\udea2|\u21aa\ufe0f|\ud83c\udf85|\ud83c\udf86|\ud83c\udf87|\ud83c\udf88|\ud83d\udea3|\ud83d\udea4|\ud83d\udea5|\ud83d\udea6|\ud83d\udea7|\ud83d\udea8|\ud83d\udea9|\ud83d\udeaa|\ud83d\udeab|\ud83d\udeac|\ud83d\udead|\ud83d\udeae|\ud83d\udeaf|\ud83d\udeb0|\ud83d\udeb1|\ud83d\udeb2|\ud83d\udeb3|\ud83c\udf89|\ud83c\udf8a|\ud83c\udf8b|\ud83c\udf8c|\ud83c\udf8d|\ud83d\udeb4|\ud83c\udf8e|\ud83c\udf8f|\ud83c\udf90|\ud83c\udf91|\ud83c\udf92|\ud83d\udeb5|\ud83c\udf93|\ud83c\udf96|\ud83c\udf97|\ud83c\udf99|\ud83c\udf9a|\ud83d\udeb6|\ud83d\udeb7|\ud83d\udeb8|\ud83d\udeb9|\ud83d\udeba|\ud83d\udebb|\ud83d\udebc|\ud83d\udebd|\ud83d\udebe|\ud83d\udebf|\ud83c\udf9b|\ud83c\udf9e|\ud83c\udf9f|\ud83c\udfa0|\ud83c\udfa1|\ud83d\udec0|\ud83d\udec1|\ud83d\udec2|\ud83d\udec3|\ud83d\udec4|\ud83d\udec5|\ud83d\udecb|\ud83c\udfa2|\ud83c\udfa3|\ud83c\udfa4|\ud83c\udfa5|\ud83c\udfa6|\ud83d\udecc|\ud83d\udecd|\ud83d\udece|\ud83d\udecf|\ud83d\uded0|\ud83d\uded1|\ud83d\uded2|\ud83d\udee0|\ud83d\udee1|\ud83d\udee2|\ud83d\udee3|\ud83d\udee4|\ud83d\udee5|\ud83d\udee9|\ud83d\udeeb|\ud83d\udeec|\ud83d\udef0|\ud83d\udef3|\ud83d\udef4|\ud83d\udef5|\ud83d\udef6|\ud83e\udd10|\ud83e\udd11|\ud83e\udd12|\ud83e\udd13|\ud83e\udd14|\ud83e\udd15|\ud83e\udd16|\ud83e\udd17|\ud83c\udfa7|\ud83c\udfa8|\ud83c\udfa9|\ud83c\udfaa|\ud83c\udfab|\ud83e\udd18|\ud83c\udfac|\ud83c\udfad|\ud83c\udfae|\ud83c\udfaf|\ud83c\udfb0|\ud83e\udd19|\ud83c\udfb1|\ud83c\udfb2|\ud83c\udfb3|\ud83c\udfb4|\ud83c\udfb5|\ud83e\udd1a|\ud83c\udfb6|\ud83c\udfb7|\ud83c\udfb8|\ud83c\udfb9|\ud83c\udfba|\ud83e\udd1b|\ud83c\udfbb|\ud83c\udfbc|\ud83c\udfbd|\ud83c\udfbe|\ud83c\udfbf|\ud83e\udd1c|\ud83e\udd1d|\ud83c\udfc0|\ud83c\udfc1|\u264c\ufe0f|\u2603\ufe0f|\u264d\ufe0f|\ud83e\udd1e|\ud83e\udd20|\ud83e\udd21|\ud83e\udd22|\ud83e\udd23|\ud83e\udd24|\ud83e\udd25|\u2049\ufe0f|\u26f9\ufe0f|\ud83c\udfc2|\u264e\ufe0f|\u26fa\ufe0f|\ud83e\udd26|\ud83e\udd27|\u2604\ufe0f|\u26fd\ufe0f|\u264f\ufe0f|\ud83c\udfc3|\u2702\ufe0f|\ud83e\udd30|\u231a\ufe0f|\u2650\ufe0f|\u2708\ufe0f|\u260e\ufe0f|\ud83c\udfc4|\ud83e\udd33|\ud83c\udfc5|\ud83c\udfc6|\u2709\ufe0f|\u2651\ufe0f|\u2195\ufe0f|\ud83e\udd34|\u2652\ufe0f|\u2611\ufe0f|\ud83c\udfc7|\ud83c\udfc8|\ud83c\udfc9|\ud83e\udd35|\u2653\ufe0f|\u231b\ufe0f|\u2660\ufe0f|\u2614\ufe0f|\u2663\ufe0f|\ud83e\udd36|\ud83c\udfca|\u00a9\ufe0f|\u2665\ufe0f|\u2615\ufe0f|\u2666\ufe0f|\ud83e\udd37|\u24c2\ufe0f|\u2668\ufe0f|\ud83c\udfcb|\u2618\ufe0f|\u267b\ufe0f|\ud83e\udd38|\u2328\ufe0f|\u270c\ufe0f|\u267f\ufe0f|\u25aa\ufe0f|\ud83c\udfcc|\ud83e\udd39|\ud83e\udd3a|\ud83e\udd3c|\ud83c\udfcd|\ud83c\udfce|\ud83c\udfcf|\ud83c\udfd0|\ud83c\udfd1|\ud83e\udd3d|\ud83c\udfd2|\ud83c\udfd3|\ud83c\udfd4|\ud83c\udfd5|\ud83c\udfd6|\ud83e\udd3e|\ud83e\udd40|\ud83e\udd41|\ud83e\udd42|\ud83e\udd43|\ud83e\udd44|\ud83e\udd45|\ud83e\udd47|\ud83e\udd48|\ud83e\udd49|\ud83e\udd4a|\ud83e\udd4b|\ud83e\udd50|\ud83e\udd51|\ud83e\udd52|\ud83e\udd53|\ud83e\udd54|\ud83e\udd55|\ud83e\udd56|\ud83e\udd57|\ud83e\udd58|\ud83e\udd59|\ud83e\udd5a|\ud83e\udd5b|\ud83e\udd5c|\ud83e\udd5d|\ud83e\udd5e|\ud83e\udd80|\ud83e\udd81|\ud83e\udd82|\ud83e\udd83|\ud83e\udd84|\ud83e\udd85|\ud83e\udd86|\ud83e\udd87|\ud83e\udd88|\ud83e\udd89|\ud83e\udd8a|\ud83e\udd8b|\ud83e\udd8c|\ud83e\udd8d|\ud83e\udd8e|\ud83e\udd8f|\ud83e\udd90|\ud83e\udd91|\ud83e\uddc0|\ud83c\udfd7|\u0023\u20e3|\ud83c\udfd8|\u002a\u20e3|\ud83c\udfd9|\u0030\u20e3|\ud83c\udfda|\u0031\u20e3|\ud83c\udfdb|\u0032\u20e3|\ud83c\udfdc|\u0033\u20e3|\ud83c\udfdd|\u0034\u20e3|\ud83c\udfde|\u0035\u20e3|\ud83c\udfdf|\u0036\u20e3|\ud83c\udfe0|\u0037\u20e3|\ud83c\udfe1|\u0038\u20e3|\ud83c\udfe2|\u0039\u20e3|\ud83c\udfe3|\ud83c\udfe4|\ud83c\udfe5|\ud83c\udfe6|\ud83c\udfe7|\ud83c\udfe8|\ud83c\udfe9|\ud83c\udfea|\ud83c\udfeb|\ud83c\udfec|\ud83c\udfed|\ud83c\udfee|\ud83c\udfef|\ud83c\udff0|\u2196\ufe0f|\ud83c\udff3|\ud83c\udff4|\ud83c\udff5|\ud83c\udff7|\ud83c\udff8|\ud83c\udff9|\ud83c\udffa|\ud83c\udffb|\ud83c\udffc|\ud83c\udffd|\ud83c\udffe|\ud83c\udfff|\ud83d\udc00|\ud83d\udc01|\ud83d\udc02|\ud83d\udc03|\ud83d\udc04|\ud83d\udc05|\ud83d\udc06|\ud83d\udc07|\ud83d\udc08|\ud83d\udc09|\ud83d\udc0a|\ud83d\udc0b|\ud83d\udc0c|\ud83d\udc0d|\ud83d\udc0e|\ud83d\udc0f|\ud83d\udc10|\ud83d\udc11|\ud83d\udc12|\ud83d\udc13|\ud83d\udc14|\ud83d\udc15|\ud83d\udc16|\ud83d\udc17|\ud83d\udc18|\ud83d\udc19|\ud83d\udc1a|\ud83d\udc1b|\ud83d\udc1c|\ud83d\udc1d|\ud83d\udc1e|\ud83d\udc1f|\ud83d\udc20|\ud83d\udc21|\ud83d\udc22|\ud83d\udc23|\ud83d\udc24|\ud83d\udc25|\ud83d\udc26|\ud83d\udc27|\ud83d\udc28|\ud83d\udc29|\ud83d\udc2a|\ud83d\udc2b|\ud83d\udc2c|\ud83d\udc2d|\ud83d\udc2e|\ud83d\udc2f|\ud83d\udc30|\ud83d\udc31|\ud83d\udc32|\ud83d\udc33|\ud83d\udc34|\ud83d\udc35|\ud83d\udc36|\ud83d\udc37|\ud83d\udc38|\ud83d\udc39|\ud83d\udc3a|\ud83d\udc3b|\ud83d\udc3c|\ud83d\udc3d|\ud83d\udc3e|\ud83d\udc3f|\ud83d\udc40|\ud83d\udc41|\u2693\ufe0f|\u25ab\ufe0f|\u2694\ufe0f|\u270d\ufe0f|\u2122\ufe0f|\ud83d\udc42|\u270f\ufe0f|\u25b6\ufe0f|\u2712\ufe0f|\u2696\ufe0f|\u2714\ufe0f|\ud83d\udc43|\ud83d\udc44|\ud83d\udc45|\u261d\ufe0f|\u2716\ufe0f|\u2697\ufe0f|\u271d\ufe0f|\u2197\ufe0f|\ud83d\udc46|\u2721\ufe0f|\u2699\ufe0f|\u2620\ufe0f|\u2733\ufe0f|\u269b\ufe0f|\ud83d\udc47|\u2734\ufe0f|\u25c0\ufe0f|\u2744\ufe0f|\u269c\ufe0f|\u2747\ufe0f|\ud83d\udc48|\u2622\ufe0f|\u26a0\ufe0f|\u203c\ufe0f|\u26a1\ufe0f|\u2623\ufe0f|\ud83d\udc49|\u26aa\ufe0f|\u2757\ufe0f|\u25fb\ufe0f|\u2763\ufe0f|\u26ab\ufe0f|\ud83d\udc4a|\u2764\ufe0f|\u2626\ufe0f|\u26b0\ufe0f|\u2198\ufe0f|\u26b1\ufe0f|\ud83d\udc4b|\u27a1\ufe0f|\u262a\ufe0f|\u26bd\ufe0f|\u25fc\ufe0f|\u2934\ufe0f|\ud83d\udc4c|\u26be\ufe0f|\u2935\ufe0f|\u262e\ufe0f|\u2b05\ufe0f|\u26c4\ufe0f|\ud83d\udc4d|\u2b06\ufe0f|\u2139\ufe0f|\u2b07\ufe0f|\u26c5\ufe0f|\u2b1b\ufe0f|\ud83d\udc4e|\u262f\ufe0f|\u2b1c\ufe0f|\u25fd\ufe0f|\u2b50\ufe0f|\u2638\ufe0f|\ud83d\udc4f|\u2b55\ufe0f|\u2199\ufe0f|\u3030\ufe0f|\u2639\ufe0f|\u303d\ufe0f|\ud83d\udc50|\ud83d\udc51|\ud83d\udc52|\ud83d\udc53|\ud83d\udc54|\ud83d\udc55|\ud83d\udc56|\ud83d\udc57|\ud83d\udc58|\ud83d\udc59|\ud83d\udc5a|\ud83d\udc5b|\ud83d\udc5c|\ud83d\udc5d|\ud83d\udc5e|\ud83d\udc5f|\ud83d\udc60|\ud83d\udc61|\ud83d\udc62|\ud83d\udc63|\ud83d\udc64|\ud83d\udc65|\u25fe\ufe0f|\u3297\ufe0f|\u26d4\ufe0f|\u3299\ufe0f|\u263a\ufe0f|\ud83d\udc66|\u00ae\ufe0f|\ud83c\udc04|\ud83c\udccf|\u26ea\ufe0f|\ud83c\udd70|\ud83d\udc67|\u2600\ufe0f|\ud83c\udd71|\u21a9\ufe0f|\ud83c\udd7e|\u2648\ufe0f|\ud83d\udc68|\ud83c\udd7f|\ud83c\udd8e|\ud83c\udd91|\ud83c\udd92|\ud83c\udd93|\ud83d\udc69|\ud83d\udc6a|\ud83d\udc6b|\ud83d\udc6c|\ud83d\udc6d|\ud83c\udd94|\ud83c\udd95|\ud83c\udd96|\ud83c\udd97|\ud83c\udd98|\ud83d\udc6e|\ud83d\udc6f|\ud83c\udd99|\ud83c\udd9a|\ud83c\ude01|\u26f2\ufe0f|\ud83c\ude02|\ud83d\udc70|\u2601\ufe0f|\ud83c\ude1a|\u26f3\ufe0f|\ud83c\ude2f|\ud83c\ude32|\ud83d\udc71|\ud83c\ude33|\ud83c\ude34|\ud83c\ude35|\ud83c\ude36|\u2649\ufe0f|\ud83d\udc72|\ud83c\ude37|\ud83c\ude38|\ud83c\ude39|\ud83c\ude3a|\ud83c\ude50|\ud83d\udc73|\ud83c\ude51|\ud83c\udf00|\ud83c\udf01|\ud83c\udf02|\ud83c\udf03|\ud83d\udc74|\ud83c\udf04|\ud83c\udf05|\ud83c\udf06|\ud83c\udf07|\ud83c\udf08|\ud83d\udc75|\ud83c\udf09|\ud83c\udf0a|\ud83c\udf0b|\ud83c\udf0c|\ud83c\udf0d|\ud83d\udc76|\ud83c\udf0e|\ud83c\udf0f|\ud83c\udf10|\ud83c\udf11|\ud83c\udf12|\ud83d\udc77|\ud83c\udf13|\ud83c\udf14|\ud83c\udf15|\ud83c\udf16|\ud83c\udf17|\ud83d\udc78|\ud83d\udc79|\ud83d\udc7a|\ud83d\udc7b|\ud83c\udf18|\ud83c\udf19|\ud83c\udf1a|\ud83c\udf1b|\ud83c\udf1c|\ud83d\udc7c|\ud83d\udc7d|\ud83d\udc7e|\ud83d\udc7f|\ud83d\udc80|\ud83c\udf1d|\ud83c\udf1e|\ud83c\udf1f|\ud83c\udf20|\ud83c\udf21|\ud83d\udc81|\ud83c\udf24|\ud83c\udf25|\ud83c\udf26|\ud83c\udf27|\ud83c\udf28|\ud83d\udc82|\ud83c\udf29|\ud83c\udf2a|\ud83c\udf2b|\ud83c\udf2c|\ud83c\udf2d|\ud83d\udc83|\ud83d\udc84|\ud83c\udf2e|\ud83c\udf2f|\ud83c\udf30|\ud83c\udf31|\ud83c\udf32|\ud83d\udc85|\ud83c\udf33|\ud83c\udf34|\ud83c\udf35|\ud83c\udf36|\ud83c\udf37|\ud83d\udc86|\ud83c\udf38|\ud83c\udf39|\ud83c\udf3a|\ud83c\udf3b|\u2194\ufe0f|\ud83d\udc87|\ud83d\udc88|\ud83d\udc89|\ud83d\udc8a|\ud83d\udc8b|\ud83d\udc8c|\ud83d\udc8d|\ud83d\udc8e|\ud83d\udc8f|\ud83d\udc90|\ud83d\udc91|\ud83d\udc92|\ud83d\udc93|\ud83d\udc94|\ud83d\udc95|\ud83d\udc96|\ud83d\udc97|\ud83d\udc98|\ud83d\udc99|\ud83d\udc9a|\ud83d\udc9b|\ud83d\udc9c|\ud83d\udc9d|\ud83d\udc9e|\ud83d\udc9f|\ud83d\udca0|\ud83d\udca1|\ud83d\udca2|\ud83d\udca3|\ud83d\udca4|\ud83d\udca5|\ud83d\udca6|\ud83d\udca7|\ud83d\udca8|\ud83d\udca9|\ud83c\udf3d|\ud83c\udf3e|\ud83c\udf3f|\ud83c\udf40|\ud83c\udf41|\ud83d\udcaa|\ud83d\udcab|\ud83d\udcac|\ud83d\udcad|\ud83d\udcae|\ud83d\udcaf|\ud83d\udcb0|\ud83d\udcb1|\ud83d\udcb2|\ud83d\udcb3|\ud83d\udcb4|\ud83d\udcb5|\ud83d\udcb6|\ud83d\udcb7|\ud83d\udcb8|\ud83d\udcb9|\ud83d\udcba|\ud83d\udcbb|\ud83d\udcbc|\ud83d\udcbd|\ud83d\udcbe|\ud83d\udcbf|\ud83d\udcc0|\ud83d\udcc1|\ud83d\udcc2|\ud83d\udcc3|\ud83d\udcc4|\ud83d\udcc5|\ud83d\udcc6|\ud83d\udcc7|\ud83d\udcc8|\ud83d\udcc9|\ud83d\udcca|\ud83d\udccb|\ud83d\udccc|\ud83d\udccd|\ud83d\udcce|\ud83d\udccf|\ud83d\udcd0|\ud83d\udcd1|\ud83d\udcd2|\ud83d\udcd3|\ud83d\udcd4|\ud83d\udcd5|\ud83d\udcd6|\ud83d\udcd7|\ud83d\udcd8|\ud83d\udcd9|\ud83d\udcda|\ud83d\udcdb|\ud83d\udcdc|\ud83d\udcdd|\ud83d\udcde|\ud83d\udcdf|\ud83d\udce0|\ud83d\udce1|\ud83d\udce2|\ud83d\udce3|\ud83d\udce4|\ud83d\udce5|\ud83d\udce6|\ud83d\udce7|\ud83d\udce8|\ud83d\udce9|\ud83d\udcea|\ud83d\udceb|\ud83d\udcec|\ud83d\udced|\ud83d\udcee|\ud83d\udcef|\ud83d\udcf0|\ud83d\udcf1|\ud83d\udcf2|\ud83d\udcf3|\ud83d\udcf4|\ud83d\udcf5|\ud83d\udcf6|\ud83d\udcf7|\ud83d\udcf8|\ud83d\udcf9|\ud83d\udcfa|\ud83d\udcfb|\ud83d\udcfc|\ud83d\udcfd|\ud83d\udcff|\ud83d\udd00|\ud83d\udd01|\ud83d\udd02|\ud83d\udd03|\ud83d\udd04|\ud83d\udd05|\ud83d\udd06|\ud83d\udd07|\ud83d\udd08|\ud83d\udd09|\ud83d\udd0a|\ud83d\udd0b|\ud83d\udd0c|\ud83d\udd0d|\ud83d\udd0e|\ud83d\udd0f|\ud83d\udd10|\ud83d\udd11|\ud83d\udd12|\ud83d\udd13|\ud83d\udd14|\ud83d\udd15|\ud83d\udd16|\ud83d\udd17|\ud83d\udd18|\ud83d\udd19|\ud83d\udd1a|\ud83d\udd1b|\ud83d\udd1c|\ud83d\udd1d|\ud83d\udd1e|\ud83d\udd1f|\ud83d\udd20|\ud83d\udd21|\ud83d\udd22|\ud83d\udd23|\ud83d\udd24|\ud83d\udd25|\ud83d\udd26|\ud83d\udd27|\ud83d\udd28|\ud83d\udd29|\ud83d\udd2a|\ud83d\udd2b|\ud83d\udd2c|\ud83d\udd2d|\ud83d\udd2e|\ud83d\udd2f|\ud83d\udd30|\ud83d\udd31|\ud83d\udd32|\ud83d\udd33|\ud83d\udd34|\ud83d\udd35|\ud83d\udd36|\ud83d\udd37|\ud83d\udd38|\ud83d\udd39|\ud83d\udd3a|\ud83d\udd3b|\ud83d\udd3c|\ud83d\udd3d|\ud83d\udd49|\ud83d\udd4a|\ud83d\udd4b|\ud83d\udd4c|\ud83d\udd4d|\ud83d\udd4e|\ud83d\udd50|\ud83d\udd51|\ud83d\udd52|\ud83d\udd53|\ud83d\udd54|\ud83d\udd55|\ud83d\udd56|\ud83d\udd57|\ud83d\udd58|\ud83d\udd59|\ud83d\udd5a|\ud83d\udd5b|\ud83d\udd5c|\ud83d\udd5d|\ud83d\udd5e|\ud83d\udd5f|\ud83d\udd60|\ud83d\udd61|\ud83d\udd62|\ud83d\udd63|\ud83d\udd64|\ud83d\udd65|\ud83d\udd66|\ud83d\udd67|\ud83d\udd6f|\ud83d\udd70|\ud83d\udd73|\ud83c\udf42|\ud83c\udf43|\ud83c\udf44|\ud83c\udf45|\ud83c\udf46|\ud83d\udd74|\ud83c\udf47|\ud83c\udf48|\ud83c\udf49|\ud83c\udf4a|\ud83c\udf4b|\ud83c\udf4c|\ud83d\udd75|\ud83d\udd76|\ud83d\udd77|\ud83d\udd78|\ud83d\udd79|\ud83c\udf4d|\ud83c\udf4e|\ud83c\udf4f|\ud83c\udf50|\ud83c\udf51|\ud83d\udd7a|\ud83d\udd87|\ud83d\udd8a|\ud83d\udd8b|\ud83d\udd8c|\ud83d\udd8d|\ud83c\udf52|\ud83c\udf53|\ud83c\udf54|\ud83c\udf55|\ud83c\udf56|\ud83d\udd90|\ud83c\udf57|\ud83c\udf58|\ud83c\udf59|\ud83c\udf5a|\ud83c\udf5b|\ud83d\udd95|\ud83c\udf5c|\ud83c\udf5d|\ud83c\udf5e|\ud83c\udf5f|\ud83c\udf60|\ud83d\udd96|\ud83d\udda4|\ud83d\udda5|\ud83d\udda8|\ud83d\uddb1|\ud83d\uddb2|\ud83d\uddbc|\ud83d\uddc2|\ud83d\uddc3|\ud83d\uddc4|\ud83d\uddd1|\ud83d\uddd2|\ud83d\uddd3|\ud83d\udddc|\ud83d\udddd|\ud83d\uddde|\ud83d\udde1|\ud83d\udde3|\ud83d\udde8|\ud83d\uddef|\ud83d\uddf3|\ud83d\uddfa|\ud83d\uddfb|\ud83d\uddfc|\ud83d\uddfd|\ud83d\uddfe|\ud83d\uddff|\ud83d\ude00|\ud83d\ude01|\ud83d\ude02|\ud83d\ude03|\ud83d\ude04|\ud83d\ude05|\ud83d\ude06|\ud83d\ude07|\ud83d\ude08|\ud83d\ude09|\ud83d\ude0a|\ud83d\ude0b|\ud83d\ude0c|\ud83d\ude0d|\ud83d\ude0e|\ud83d\ude0f|\ud83d\ude10|\ud83d\ude11|\ud83d\ude12|\ud83d\ude13|\ud83d\ude14|\ud83d\ude15|\ud83d\ude16|\ud83d\ude17|\ud83d\ude18|\ud83d\ude19|\ud83d\ude1a|\ud83d\ude1b|\ud83d\ude1c|\ud83d\ude1d|\ud83d\ude1e|\ud83d\ude1f|\ud83d\ude20|\ud83d\ude21|\ud83d\ude22|\ud83d\ude23|\ud83d\ude24|\ud83d\ude25|\ud83d\ude26|\ud83d\ude27|\ud83d\ude28|\ud83d\ude29|\ud83d\ude2a|\ud83d\ude2b|\ud83d\ude2c|\ud83d\ude2d|\ud83d\ude2e|\ud83d\ude2f|\ud83d\ude30|\ud83d\ude31|\ud83d\ude32|\ud83d\ude33|\ud83d\ude34|\ud83d\ude35|\ud83d\ude36|\ud83d\ude37|\ud83d\ude38|\ud83d\ude39|\ud83d\ude3a|\ud83d\ude3b|\ud83d\ude3c|\ud83d\ude3d|\ud83d\ude3e|\ud83d\ude3f|\ud83d\ude40|\ud83d\ude41|\ud83d\ude42|\ud83c\udf3c|\u00a9|\u3297|\u303d|\u3030|\u2b55|\u2b50|\u2b1c|\u2b1b|\u2b07|\u2b06|\u2b05|\u2935|\u2934|\u27bf|\u27b0|\u27a1|\u2797|\u2796|\u2795|\u2764|\u2763|\u2757|\u2755|\u2754|\u2753|\u274e|\u274c|\u2747|\u2744|\u2734|\u2733|\u2728|\u2721|\u271d|\u2716|\u2714|\u2712|\u270f|\u270d|\u270c|\u270b|\u270a|\u2709|\u2708|\u2705|\u2702|\u26fd|\u26fa|\u26f9|\u26f8|\u26f7|\u26f5|\u26f4|\u26f3|\u26f2|\u26f1|\u26f0|\u26ea|\u26e9|\u26d4|\u26d3|\u26d1|\u26cf|\u26ce|\u26c8|\u26c5|\u26c4|\u26be|\u26bd|\u26b1|\u26b0|\u26ab|\u26aa|\u26a1|\u26a0|\u269c|\u269b|\u2699|\u2697|\u2696|\u2695|\u2694|\u2693|\u3299|\u267f|\u267b|\u2668|\u2666|\u2665|\u2663|\u2660|\u2653|\u2652|\u2651|\u2650|\u264f|\u264e|\u264d|\u264c|\u264b|\u264a|\u2649|\u2648|\u2642|\u2640|\u263a|\u2639|\u2638|\u262f|\u262e|\u262a|\u2626|\u2623|\u2622|\u2620|\u261d|\u2618|\u2615|\u2614|\u2611|\u260e|\u2604|\u2603|\u2602|\u2601|\u2600|\u25fe|\u25fd|\u25fc|\u25fb|\u25c0|\u25b6|\u25ab|\u25aa|\u24c2|\u23fa|\u23f9|\u23f8|\u23f3|\u23f2|\u23f1|\u23f0|\u23ef|\u23ee|\u23ed|\u23ec|\u23eb|\u23ea|\u23e9|\u23cf|\u2328|\u231b|\u231a|\u21aa|\u21a9|\u2199|\u2198|\u2197|\u2196|\u2195|\u2194|\u2139|\u2122|\u2049|\u203c|\u00ae|\u2692/g
    const emojiIndexByChar = {"©️":":copyright:","©":":copyright:","®️":":registered:","®":":registered:","‼️":":bangbang:","‼":":bangbang:","⁉️":":interrobang:","⁉":":interrobang:","™️":":tm:","™":":tm:","ℹ️":":information_source:","ℹ":":information_source:","↔️":":left_right_arrow:","↔":":left_right_arrow:","↕️":":arrow_up_down:","↕":":arrow_up_down:","↖️":":arrow_upper_left:","↖":":arrow_upper_left:","↗️":":arrow_upper_right:","↗":":arrow_upper_right:","↘️":":arrow_lower_right:","↘":":arrow_lower_right:","↙️":":arrow_lower_left:","↙":":arrow_lower_left:","↩️":":leftwards_arrow_with_hook:","↩":":leftwards_arrow_with_hook:","↪️":":arrow_right_hook:","↪":":arrow_right_hook:","⌚️":":watch:","⌚":":watch:","⌛️":":hourglass:","⌛":":hourglass:","⌨️":":keyboard:","⌨":":keyboard:","⏏":":eject:","⏩":":fast_forward:","⏪":":rewind:","⏫":":arrow_double_up:","⏬":":arrow_double_down:","⏭":":black_right_pointing_double_triangle_with_vertical_bar:","⏮":":black_left_pointing_double_triangle_with_vertical_bar:","⏯":":black_right_pointing_triangle_with_double_vertical_bar:","⏰":":alarm_clock:","⏱":":stopwatch:","⏲":":timer_clock:","⏳":":hourglass_flowing_sand:","⏸":":double_vertical_bar:","⏹":":black_square_for_stop:","⏺":":black_circle_for_record:","Ⓜ️":":m:","Ⓜ":":m:","▪️":":black_small_square:","▪":":black_small_square:","▫️":":white_small_square:","▫":":white_small_square:","▶️":":arrow_forward:","▶":":arrow_forward:","◀️":":arrow_backward:","◀":":arrow_backward:","◻️":":white_medium_square:","◻":":white_medium_square:","◼️":":black_medium_square:","◼":":black_medium_square:","◽️":":white_medium_small_square:","◽":":white_medium_small_square:","◾️":":black_medium_small_square:","◾":":black_medium_small_square:","☀️":":sunny:","☀":":sunny:","☁️":":cloud:","☁":":cloud:","☂️":":umbrella:","☂":":umbrella:","☃️":":snowman:","☃":":snowman:","☄️":":comet:","☄":":comet:","☎️":":phone:","☎":":phone:","☑️":":ballot_box_with_check:","☑":":ballot_box_with_check:","☔️":":umbrella_with_rain_drops:","☔":":umbrella_with_rain_drops:","☕️":":coffee:","☕":":coffee:","☘️":":shamrock:","☘":":shamrock:","☝🏻":":point_up::skin-tone-1:","☝🏼":":point_up::skin-tone-2:","☝🏽":":point_up::skin-tone-3:","☝🏾":":point_up::skin-tone-4:","☝🏿":":point_up::skin-tone-5:","☝️":":point_up:","☝":":point_up:","☠️":":skull_and_crossbones:","☠":":skull_and_crossbones:","☢️":":radioactive_sign:","☢":":radioactive_sign:","☣️":":biohazard_sign:","☣":":biohazard_sign:","☦️":":orthodox_cross:","☦":":orthodox_cross:","☪️":":star_and_crescent:","☪":":star_and_crescent:","☮️":":peace_symbol:","☮":":peace_symbol:","☯️":":yin_yang:","☯":":yin_yang:","☸️":":wheel_of_dharma:","☸":":wheel_of_dharma:","☹️":":white_frowning_face:","☹":":white_frowning_face:","☺️":":relaxed:","☺":":relaxed:","♀":":female_sign:","♂":":male_sign:","♈️":":aries:","♈":":aries:","♉️":":taurus:","♉":":taurus:","♊️":":gemini:","♊":":gemini:","♋️":":cancer:","♋":":cancer:","♌️":":leo:","♌":":leo:","♍️":":virgo:","♍":":virgo:","♎️":":libra:","♎":":libra:","♏️":":scorpius:","♏":":scorpius:","♐️":":sagittarius:","♐":":sagittarius:","♑️":":capricorn:","♑":":capricorn:","♒️":":aquarius:","♒":":aquarius:","♓️":":pisces:","♓":":pisces:","♠️":":spades:","♠":":spades:","♣️":":clubs:","♣":":clubs:","♥️":":hearts:","♥":":hearts:","♦️":":diamonds:","♦":":diamonds:","♨️":":hotsprings:","♨":":hotsprings:","♻️":":recycle:","♻":":recycle:","♿️":":wheelchair:","♿":":wheelchair:","⚒":":hammer_and_pick:","⚓️":":anchor:","⚓":":anchor:","⚔️":":crossed_swords:","⚔":":crossed_swords:","⚕":":staff_of_aesculapius:","⚖️":":scales:","⚖":":scales:","⚗️":":alembic:","⚗":":alembic:","⚙️":":gear:","⚙":":gear:","⚛️":":atom_symbol:","⚛":":atom_symbol:","⚜️":":fleur_de_lis:","⚜":":fleur_de_lis:","⚠️":":warning:","⚠":":warning:","⚡️":":zap:","⚡":":zap:","⚪️":":white_circle:","⚪":":white_circle:","⚫️":":black_circle:","⚫":":black_circle:","⚰️":":coffin:","⚰":":coffin:","⚱️":":funeral_urn:","⚱":":funeral_urn:","⚽️":":soccer:","⚽":":soccer:","⚾️":":baseball:","⚾":":baseball:","⛄️":":snowman_without_snow:","⛄":":snowman_without_snow:","⛅️":":partly_sunny:","⛅":":partly_sunny:","⛈":":thunder_cloud_and_rain:","⛎":":ophiuchus:","⛏":":pick:","⛑":":helmet_with_white_cross:","⛓":":chains:","⛔️":":no_entry:","⛔":":no_entry:","⛩":":shinto_shrine:","⛪️":":church:","⛪":":church:","⛰":":mountain:","⛱":":umbrella_on_ground:","⛲️":":fountain:","⛲":":fountain:","⛳️":":golf:","⛳":":golf:","⛴":":ferry:","⛵️":":boat:","⛵":":boat:","⛷":":skier:","⛸":":ice_skate:","⛹🏻":":person_with_ball::skin-tone-1:","⛹🏼":":person_with_ball::skin-tone-2:","⛹🏽":":person_with_ball::skin-tone-3:","⛹🏾":":person_with_ball::skin-tone-4:","⛹🏿":":person_with_ball::skin-tone-5:","⛹️":":person_with_ball:","⛹":":person_with_ball:","⛺️":":tent:","⛺":":tent:","⛽️":":fuelpump:","⛽":":fuelpump:","✂️":":scissors:","✂":":scissors:","✅":":white_check_mark:","✈️":":airplane:","✈":":airplane:","✉️":":email:","✉":":email:","✊🏻":":fist::skin-tone-1:","✊🏼":":fist::skin-tone-2:","✊🏽":":fist::skin-tone-3:","✊🏾":":fist::skin-tone-4:","✊🏿":":fist::skin-tone-5:","✊":":fist:","✋🏻":":hand::skin-tone-1:","✋🏼":":hand::skin-tone-2:","✋🏽":":hand::skin-tone-3:","✋🏾":":hand::skin-tone-4:","✋🏿":":hand::skin-tone-5:","✋":":hand:","✌🏻":":v::skin-tone-1:","✌🏼":":v::skin-tone-2:","✌🏽":":v::skin-tone-3:","✌🏾":":v::skin-tone-4:","✌🏿":":v::skin-tone-5:","✌️":":v:","✌":":v:","✍🏻":":writing_hand::skin-tone-1:","✍🏼":":writing_hand::skin-tone-2:","✍🏽":":writing_hand::skin-tone-3:","✍🏾":":writing_hand::skin-tone-4:","✍🏿":":writing_hand::skin-tone-5:","✍️":":writing_hand:","✍":":writing_hand:","✏️":":pencil2:","✏":":pencil2:","✒️":":black_nib:","✒":":black_nib:","✔️":":heavy_check_mark:","✔":":heavy_check_mark:","✖️":":heavy_multiplication_x:","✖":":heavy_multiplication_x:","✝️":":latin_cross:","✝":":latin_cross:","✡️":":star_of_david:","✡":":star_of_david:","✨":":sparkles:","✳️":":eight_spoked_asterisk:","✳":":eight_spoked_asterisk:","✴️":":eight_pointed_black_star:","✴":":eight_pointed_black_star:","❄️":":snowflake:","❄":":snowflake:","❇️":":sparkle:","❇":":sparkle:","❌":":x:","❎":":negative_squared_cross_mark:","❓":":question:","❔":":grey_question:","❕":":grey_exclamation:","❗️":":exclamation:","❗":":exclamation:","❣️":":heavy_heart_exclamation_mark_ornament:","❣":":heavy_heart_exclamation_mark_ornament:","❤️":":heart:","❤":":heart:","➕":":heavy_plus_sign:","➖":":heavy_minus_sign:","➗":":heavy_division_sign:","➡️":":arrow_right:","➡":":arrow_right:","➰":":curly_loop:","➿":":loop:","⤴️":":arrow_heading_up:","⤴":":arrow_heading_up:","⤵️":":arrow_heading_down:","⤵":":arrow_heading_down:","⬅️":":arrow_left:","⬅":":arrow_left:","⬆️":":arrow_up:","⬆":":arrow_up:","⬇️":":arrow_down:","⬇":":arrow_down:","⬛️":":black_large_square:","⬛":":black_large_square:","⬜️":":white_large_square:","⬜":":white_large_square:","⭐️":":star:","⭐":":star:","⭕️":":o:","⭕":":o:","〰️":":wavy_dash:","〰":":wavy_dash:","〽️":":part_alternation_mark:","〽":":part_alternation_mark:","㊗️":":congratulations:","㊗":":congratulations:","㊙️":":secret:","㊙":":secret:","🀄️":":mahjong:","🀄":":mahjong:","🃏":":black_joker:","🅰️":":a:","🅰":":a:","🅱️":":b:","🅱":":b:","🅾️":":o2:","🅾":":o2:","🅿️":":parking:","🅿":":parking:","🆎":":ab:","🆑":":cl:","🆒":":cool:","🆓":":free:","🆔":":id:","🆕":":new:","🆖":":ng:","🆗":":ok:","🆘":":sos:","🆙":":up:","🆚":":vs:","🈁":":koko:","🈂️":":sa:","🈂":":sa:","🈚️":":u7121:","🈚":":u7121:","🈯️":":u6307:","🈯":":u6307:","🈲":":u7981:","🈳":":u7a7a:","🈴":":u5408:","🈵":":u6e80:","🈶":":u6709:","🈷️":":u6708:","🈷":":u6708:","🈸":":u7533:","🈹":":u5272:","🈺":":u55b6:","🉐":":ideograph_advantage:","🉑":":accept:","🌀":":cyclone:","🌁":":foggy:","🌂":":closed_umbrella:","🌃":":night_with_stars:","🌄":":sunrise_over_mountains:","🌅":":sunrise:","🌆":":city_sunset:","🌇":":city_sunrise:","🌈":":rainbow:","🌉":":bridge_at_night:","🌊":":ocean:","🌋":":volcano:","🌌":":milky_way:","🌍":":earth_africa:","🌎":":earth_americas:","🌏":":earth_asia:","🌐":":globe_with_meridians:","🌑":":new_moon:","🌒":":waxing_crescent_moon:","🌓":":first_quarter_moon:","🌔":":moon:","🌕":":full_moon:","🌖":":waning_gibbous_moon:","🌗":":last_quarter_moon:","🌘":":waning_crescent_moon:","🌙":":crescent_moon:","🌚":":new_moon_with_face:","🌛":":first_quarter_moon_with_face:","🌜":":last_quarter_moon_with_face:","🌝":":full_moon_with_face:","🌞":":sun_with_face:","🌟":":star2:","🌠":":stars:","🌡":":thermometer:","🌤":":mostly_sunny:","🌥":":barely_sunny:","🌦":":partly_sunny_rain:","🌧":":rain_cloud:","🌨":":snow_cloud:","🌩":":lightning:","🌪":":tornado:","🌫":":fog:","🌬":":wind_blowing_face:","🌭":":hotdog:","🌮":":taco:","🌯":":burrito:","🌰":":chestnut:","🌱":":seedling:","🌲":":evergreen_tree:","🌳":":deciduous_tree:","🌴":":palm_tree:","🌵":":cactus:","🌶":":hot_pepper:","🌷":":tulip:","🌸":":cherry_blossom:","🌹":":rose:","🌺":":hibiscus:","🌻":":sunflower:","🌼":":blossom:","🌽":":corn:","🌾":":ear_of_rice:","🌿":":herb:","🍀":":four_leaf_clover:","🍁":":maple_leaf:","🍂":":fallen_leaf:","🍃":":leaves:","🍄":":mushroom:","🍅":":tomato:","🍆":":eggplant:","🍇":":grapes:","🍈":":melon:","🍉":":watermelon:","🍊":":tangerine:","🍋":":lemon:","🍌":":banana:","🍍":":pineapple:","🍎":":apple:","🍏":":green_apple:","🍐":":pear:","🍑":":peach:","🍒":":cherries:","🍓":":strawberry:","🍔":":hamburger:","🍕":":pizza:","🍖":":meat_on_bone:","🍗":":poultry_leg:","🍘":":rice_cracker:","🍙":":rice_ball:","🍚":":rice:","🍛":":curry:","🍜":":ramen:","🍝":":spaghetti:","🍞":":bread:","🍟":":fries:","🍠":":sweet_potato:","🍡":":dango:","🍢":":oden:","🍣":":sushi:","🍤":":fried_shrimp:","🍥":":fish_cake:","🍦":":icecream:","🍧":":shaved_ice:","🍨":":ice_cream:","🍩":":doughnut:","🍪":":cookie:","🍫":":chocolate_bar:","🍬":":candy:","🍭":":lollipop:","🍮":":custard:","🍯":":honey_pot:","🍰":":cake:","🍱":":bento:","🍲":":stew:","🍳":":fried_egg:","🍴":":fork_and_knife:","🍵":":tea:","🍶":":sake:","🍷":":wine_glass:","🍸":":cocktail:","🍹":":tropical_drink:","🍺":":beer:","🍻":":beers:","🍼":":baby_bottle:","🍽":":knife_fork_plate:","🍾":":champagne:","🍿":":popcorn:","🎀":":ribbon:","🎁":":gift:","🎂":":birthday:","🎃":":jack_o_lantern:","🎄":":christmas_tree:","🎅🏻":":santa::skin-tone-1:","🎅🏼":":santa::skin-tone-2:","🎅🏽":":santa::skin-tone-3:","🎅🏾":":santa::skin-tone-4:","🎅🏿":":santa::skin-tone-5:","🎅":":santa:","🎆":":fireworks:","🎇":":sparkler:","🎈":":balloon:","🎉":":tada:","🎊":":confetti_ball:","🎋":":tanabata_tree:","🎌":":crossed_flags:","🎍":":bamboo:","🎎":":dolls:","🎏":":flags:","🎐":":wind_chime:","🎑":":rice_scene:","🎒":":school_satchel:","🎓":":mortar_board:","🎖":":medal:","🎗":":reminder_ribbon:","🎙":":studio_microphone:","🎚":":level_slider:","🎛":":control_knobs:","🎞":":film_frames:","🎟":":admission_tickets:","🎠":":carousel_horse:","🎡":":ferris_wheel:","🎢":":roller_coaster:","🎣":":fishing_pole_and_fish:","🎤":":microphone:","🎥":":movie_camera:","🎦":":cinema:","🎧":":headphones:","🎨":":art:","🎩":":tophat:","🎪":":circus_tent:","🎫":":ticket:","🎬":":clapper:","🎭":":performing_arts:","🎮":":video_game:","🎯":":dart:","🎰":":slot_machine:","🎱":":8ball:","🎲":":game_die:","🎳":":bowling:","🎴":":flower_playing_cards:","🎵":":musical_note:","🎶":":notes:","🎷":":saxophone:","🎸":":guitar:","🎹":":musical_keyboard:","🎺":":trumpet:","🎻":":violin:","🎼":":musical_score:","🎽":":running_shirt_with_sash:","🎾":":tennis:","🎿":":ski:","🏀":":basketball:","🏁":":checkered_flag:","🏂🏻":":snowboarder::skin-tone-1:","🏂🏼":":snowboarder::skin-tone-2:","🏂🏽":":snowboarder::skin-tone-3:","🏂🏾":":snowboarder::skin-tone-4:","🏂🏿":":snowboarder::skin-tone-5:","🏂":":snowboarder:","🏃🏻":":runner::skin-tone-1:","🏃🏼":":runner::skin-tone-2:","🏃🏽":":runner::skin-tone-3:","🏃🏾":":runner::skin-tone-4:","🏃🏿":":runner::skin-tone-5:","🏃":":runner:","🏄🏻":":surfer::skin-tone-1:","🏄🏼":":surfer::skin-tone-2:","🏄🏽":":surfer::skin-tone-3:","🏄🏾":":surfer::skin-tone-4:","🏄🏿":":surfer::skin-tone-5:","🏄":":surfer:","🏅":":sports_medal:","🏆":":trophy:","🏇🏻":":horse_racing::skin-tone-1:","🏇🏼":":horse_racing::skin-tone-2:","🏇🏽":":horse_racing::skin-tone-3:","🏇🏾":":horse_racing::skin-tone-4:","🏇🏿":":horse_racing::skin-tone-5:","🏇":":horse_racing:","🏈":":football:","🏉":":rugby_football:","🏊🏻":":swimmer::skin-tone-1:","🏊🏼":":swimmer::skin-tone-2:","🏊🏽":":swimmer::skin-tone-3:","🏊🏾":":swimmer::skin-tone-4:","🏊🏿":":swimmer::skin-tone-5:","🏊":":swimmer:","🏋🏻":":weight_lifter::skin-tone-1:","🏋🏼":":weight_lifter::skin-tone-2:","🏋🏽":":weight_lifter::skin-tone-3:","🏋🏾":":weight_lifter::skin-tone-4:","🏋🏿":":weight_lifter::skin-tone-5:","🏋️":":weight_lifter:","🏋":":weight_lifter:","🏌🏻":":golfer::skin-tone-1:","🏌🏼":":golfer::skin-tone-2:","🏌🏽":":golfer::skin-tone-3:","🏌🏾":":golfer::skin-tone-4:","🏌🏿":":golfer::skin-tone-5:","🏌️":":golfer:","🏌":":golfer:","🏍":":racing_motorcycle:","🏎":":racing_car:","🏏":":cricket_bat_and_ball:","🏐":":volleyball:","🏑":":field_hockey_stick_and_ball:","🏒":":ice_hockey_stick_and_puck:","🏓":":table_tennis_paddle_and_ball:","🏔":":snow_capped_mountain:","🏕":":camping:","🏖":":beach_with_umbrella:","🏗":":building_construction:","🏘":":house_buildings:","🏙":":cityscape:","🏚":":derelict_house_building:","🏛":":classical_building:","🏜":":desert:","🏝":":desert_island:","🏞":":national_park:","🏟":":stadium:","🏠":":house:","🏡":":house_with_garden:","🏢":":office:","🏣":":post_office:","🏤":":european_post_office:","🏥":":hospital:","🏦":":bank:","🏧":":atm:","🏨":":hotel:","🏩":":love_hotel:","🏪":":convenience_store:","🏫":":school:","🏬":":department_store:","🏭":":factory:","🏮":":izakaya_lantern:","🏯":":japanese_castle:","🏰":":european_castle:","🏳️":":waving_white_flag:","🏳":":waving_white_flag:","🏴":":waving_black_flag:","🏵":":rosette:","🏷":":label:","🏸":":badminton_racquet_and_shuttlecock:","🏹":":bow_and_arrow:","🏺":":amphora:","🏻":":skin-tone-2:","🏼":":skin-tone-3:","🏽":":skin-tone-4:","🏾":":skin-tone-5:","🏿":":skin-tone-6:","🐀":":rat:","🐁":":mouse2:","🐂":":ox:","🐃":":water_buffalo:","🐄":":cow2:","🐅":":tiger2:","🐆":":leopard:","🐇":":rabbit2:","🐈":":cat2:","🐉":":dragon:","🐊":":crocodile:","🐋":":whale2:","🐌":":snail:","🐍":":snake:","🐎":":racehorse:","🐏":":ram:","🐐":":goat:","🐑":":sheep:","🐒":":monkey:","🐓":":rooster:","🐔":":chicken:","🐕":":dog2:","🐖":":pig2:","🐗":":boar:","🐘":":elephant:","🐙":":octopus:","🐚":":shell:","🐛":":bug:","🐜":":ant:","🐝":":bee:","🐞":":beetle:","🐟":":fish:","🐠":":tropical_fish:","🐡":":blowfish:","🐢":":turtle:","🐣":":hatching_chick:","🐤":":baby_chick:","🐥":":hatched_chick:","🐦":":bird:","🐧":":penguin:","🐨":":koala:","🐩":":poodle:","🐪":":dromedary_camel:","🐫":":camel:","🐬":":dolphin:","🐭":":mouse:","🐮":":cow:","🐯":":tiger:","🐰":":rabbit:","🐱":":cat:","🐲":":dragon_face:","🐳":":whale:","🐴":":horse:","🐵":":monkey_face:","🐶":":dog:","🐷":":pig:","🐸":":frog:","🐹":":hamster:","🐺":":wolf:","🐻":":bear:","🐼":":panda_face:","🐽":":pig_nose:","🐾":":feet:","🐿":":chipmunk:","👀":":eyes:","👁":":eye:","👂🏻":":ear::skin-tone-1:","👂🏼":":ear::skin-tone-2:","👂🏽":":ear::skin-tone-3:","👂🏾":":ear::skin-tone-4:","👂🏿":":ear::skin-tone-5:","👂":":ear:","👃🏻":":nose::skin-tone-1:","👃🏼":":nose::skin-tone-2:","👃🏽":":nose::skin-tone-3:","👃🏾":":nose::skin-tone-4:","👃🏿":":nose::skin-tone-5:","👃":":nose:","👄":":lips:","👅":":tongue:","👆🏻":":point_up_2::skin-tone-1:","👆🏼":":point_up_2::skin-tone-2:","👆🏽":":point_up_2::skin-tone-3:","👆🏾":":point_up_2::skin-tone-4:","👆🏿":":point_up_2::skin-tone-5:","👆":":point_up_2:","👇🏻":":point_down::skin-tone-1:","👇🏼":":point_down::skin-tone-2:","👇🏽":":point_down::skin-tone-3:","👇🏾":":point_down::skin-tone-4:","👇🏿":":point_down::skin-tone-5:","👇":":point_down:","👈🏻":":point_left::skin-tone-1:","👈🏼":":point_left::skin-tone-2:","👈🏽":":point_left::skin-tone-3:","👈🏾":":point_left::skin-tone-4:","👈🏿":":point_left::skin-tone-5:","👈":":point_left:","👉🏻":":point_right::skin-tone-1:","👉🏼":":point_right::skin-tone-2:","👉🏽":":point_right::skin-tone-3:","👉🏾":":point_right::skin-tone-4:","👉🏿":":point_right::skin-tone-5:","👉":":point_right:","👊🏻":":facepunch::skin-tone-1:","👊🏼":":facepunch::skin-tone-2:","👊🏽":":facepunch::skin-tone-3:","👊🏾":":facepunch::skin-tone-4:","👊🏿":":facepunch::skin-tone-5:","👊":":facepunch:","👋🏻":":wave::skin-tone-1:","👋🏼":":wave::skin-tone-2:","👋🏽":":wave::skin-tone-3:","👋🏾":":wave::skin-tone-4:","👋🏿":":wave::skin-tone-5:","👋":":wave:","👌🏻":":ok_hand::skin-tone-1:","👌🏼":":ok_hand::skin-tone-2:","👌🏽":":ok_hand::skin-tone-3:","👌🏾":":ok_hand::skin-tone-4:","👌🏿":":ok_hand::skin-tone-5:","👌":":ok_hand:","👍🏻":":+1::skin-tone-1:","👍🏼":":+1::skin-tone-2:","👍🏽":":+1::skin-tone-3:","👍🏾":":+1::skin-tone-4:","👍🏿":":+1::skin-tone-5:","👍":":+1:","👎🏻":":-1::skin-tone-1:","👎🏼":":-1::skin-tone-2:","👎🏽":":-1::skin-tone-3:","👎🏾":":-1::skin-tone-4:","👎🏿":":-1::skin-tone-5:","👎":":-1:","👏🏻":":clap::skin-tone-1:","👏🏼":":clap::skin-tone-2:","👏🏽":":clap::skin-tone-3:","👏🏾":":clap::skin-tone-4:","👏🏿":":clap::skin-tone-5:","👏":":clap:","👐🏻":":open_hands::skin-tone-1:","👐🏼":":open_hands::skin-tone-2:","👐🏽":":open_hands::skin-tone-3:","👐🏾":":open_hands::skin-tone-4:","👐🏿":":open_hands::skin-tone-5:","👐":":open_hands:","👑":":crown:","👒":":womans_hat:","👓":":eyeglasses:","👔":":necktie:","👕":":shirt:","👖":":jeans:","👗":":dress:","👘":":kimono:","👙":":bikini:","👚":":womans_clothes:","👛":":purse:","👜":":handbag:","👝":":pouch:","👞":":mans_shoe:","👟":":athletic_shoe:","👠":":high_heel:","👡":":sandal:","👢":":boot:","👣":":footprints:","👤":":bust_in_silhouette:","👥":":busts_in_silhouette:","👦🏻":":boy::skin-tone-1:","👦🏼":":boy::skin-tone-2:","👦🏽":":boy::skin-tone-3:","👦🏾":":boy::skin-tone-4:","👦🏿":":boy::skin-tone-5:","👦":":boy:","👧🏻":":girl::skin-tone-1:","👧🏼":":girl::skin-tone-2:","👧🏽":":girl::skin-tone-3:","👧🏾":":girl::skin-tone-4:","👧🏿":":girl::skin-tone-5:","👧":":girl:","👨🏻":":man::skin-tone-1:","👨🏼":":man::skin-tone-2:","👨🏽":":man::skin-tone-3:","👨🏾":":man::skin-tone-4:","👨🏿":":man::skin-tone-5:","👨":":man:","👩🏻":":woman::skin-tone-1:","👩🏼":":woman::skin-tone-2:","👩🏽":":woman::skin-tone-3:","👩🏾":":woman::skin-tone-4:","👩🏿":":woman::skin-tone-5:","👩":":woman:","👪":":family:","👫":":couple:","👬":":two_men_holding_hands:","👭":":two_women_holding_hands:","👮🏻":":cop::skin-tone-1:","👮🏼":":cop::skin-tone-2:","👮🏽":":cop::skin-tone-3:","👮🏾":":cop::skin-tone-4:","👮🏿":":cop::skin-tone-5:","👮":":cop:","👯":":dancers:","👰🏻":":bride_with_veil::skin-tone-1:","👰🏼":":bride_with_veil::skin-tone-2:","👰🏽":":bride_with_veil::skin-tone-3:","👰🏾":":bride_with_veil::skin-tone-4:","👰🏿":":bride_with_veil::skin-tone-5:","👰":":bride_with_veil:","👱🏻":":person_with_blond_hair::skin-tone-1:","👱🏼":":person_with_blond_hair::skin-tone-2:","👱🏽":":person_with_blond_hair::skin-tone-3:","👱🏾":":person_with_blond_hair::skin-tone-4:","👱🏿":":person_with_blond_hair::skin-tone-5:","👱":":person_with_blond_hair:","👲🏻":":man_with_gua_pi_mao::skin-tone-1:","👲🏼":":man_with_gua_pi_mao::skin-tone-2:","👲🏽":":man_with_gua_pi_mao::skin-tone-3:","👲🏾":":man_with_gua_pi_mao::skin-tone-4:","👲🏿":":man_with_gua_pi_mao::skin-tone-5:","👲":":man_with_gua_pi_mao:","👳🏻":":man_with_turban::skin-tone-1:","👳🏼":":man_with_turban::skin-tone-2:","👳🏽":":man_with_turban::skin-tone-3:","👳🏾":":man_with_turban::skin-tone-4:","👳🏿":":man_with_turban::skin-tone-5:","👳":":man_with_turban:","👴🏻":":older_man::skin-tone-1:","👴🏼":":older_man::skin-tone-2:","👴🏽":":older_man::skin-tone-3:","👴🏾":":older_man::skin-tone-4:","👴🏿":":older_man::skin-tone-5:","👴":":older_man:","👵🏻":":older_woman::skin-tone-1:","👵🏼":":older_woman::skin-tone-2:","👵🏽":":older_woman::skin-tone-3:","👵🏾":":older_woman::skin-tone-4:","👵🏿":":older_woman::skin-tone-5:","👵":":older_woman:","👶🏻":":baby::skin-tone-1:","👶🏼":":baby::skin-tone-2:","👶🏽":":baby::skin-tone-3:","👶🏾":":baby::skin-tone-4:","👶🏿":":baby::skin-tone-5:","👶":":baby:","👷🏻":":construction_worker::skin-tone-1:","👷🏼":":construction_worker::skin-tone-2:","👷🏽":":construction_worker::skin-tone-3:","👷🏾":":construction_worker::skin-tone-4:","👷🏿":":construction_worker::skin-tone-5:","👷":":construction_worker:","👸🏻":":princess::skin-tone-1:","👸🏼":":princess::skin-tone-2:","👸🏽":":princess::skin-tone-3:","👸🏾":":princess::skin-tone-4:","👸🏿":":princess::skin-tone-5:","👸":":princess:","👹":":japanese_ogre:","👺":":japanese_goblin:","👻":":ghost:","👼🏻":":angel::skin-tone-1:","👼🏼":":angel::skin-tone-2:","👼🏽":":angel::skin-tone-3:","👼🏾":":angel::skin-tone-4:","👼🏿":":angel::skin-tone-5:","👼":":angel:","👽":":alien:","👾":":space_invader:","👿":":imp:","💀":":skull:","💁🏻":":information_desk_person::skin-tone-1:","💁🏼":":information_desk_person::skin-tone-2:","💁🏽":":information_desk_person::skin-tone-3:","💁🏾":":information_desk_person::skin-tone-4:","💁🏿":":information_desk_person::skin-tone-5:","💁":":information_desk_person:","💂🏻":":guardsman::skin-tone-1:","💂🏼":":guardsman::skin-tone-2:","💂🏽":":guardsman::skin-tone-3:","💂🏾":":guardsman::skin-tone-4:","💂🏿":":guardsman::skin-tone-5:","💂":":guardsman:","💃🏻":":dancer::skin-tone-1:","💃🏼":":dancer::skin-tone-2:","💃🏽":":dancer::skin-tone-3:","💃🏾":":dancer::skin-tone-4:","💃🏿":":dancer::skin-tone-5:","💃":":dancer:","💄":":lipstick:","💅🏻":":nail_care::skin-tone-1:","💅🏼":":nail_care::skin-tone-2:","💅🏽":":nail_care::skin-tone-3:","💅🏾":":nail_care::skin-tone-4:","💅🏿":":nail_care::skin-tone-5:","💅":":nail_care:","💆🏻":":massage::skin-tone-1:","💆🏼":":massage::skin-tone-2:","💆🏽":":massage::skin-tone-3:","💆🏾":":massage::skin-tone-4:","💆🏿":":massage::skin-tone-5:","💆":":massage:","💇🏻":":haircut::skin-tone-1:","💇🏼":":haircut::skin-tone-2:","💇🏽":":haircut::skin-tone-3:","💇🏾":":haircut::skin-tone-4:","💇🏿":":haircut::skin-tone-5:","💇":":haircut:","💈":":barber:","💉":":syringe:","💊":":pill:","💋":":kiss:","💌":":love_letter:","💍":":ring:","💎":":gem:","💏":":couplekiss:","💐":":bouquet:","💑":":couple_with_heart:","💒":":wedding:","💓":":heartbeat:","💔":":broken_heart:","💕":":two_hearts:","💖":":sparkling_heart:","💗":":heartpulse:","💘":":cupid:","💙":":blue_heart:","💚":":green_heart:","💛":":yellow_heart:","💜":":purple_heart:","💝":":gift_heart:","💞":":revolving_hearts:","💟":":heart_decoration:","💠":":diamond_shape_with_a_dot_inside:","💡":":bulb:","💢":":anger:","💣":":bomb:","💤":":zzz:","💥":":boom:","💦":":sweat_drops:","💧":":droplet:","💨":":dash:","💩":":hankey:","💪🏻":":muscle::skin-tone-1:","💪🏼":":muscle::skin-tone-2:","💪🏽":":muscle::skin-tone-3:","💪🏾":":muscle::skin-tone-4:","💪🏿":":muscle::skin-tone-5:","💪":":muscle:","💫":":dizzy:","💬":":speech_balloon:","💭":":thought_balloon:","💮":":white_flower:","💯":":100:","💰":":moneybag:","💱":":currency_exchange:","💲":":heavy_dollar_sign:","💳":":credit_card:","💴":":yen:","💵":":dollar:","💶":":euro:","💷":":pound:","💸":":money_with_wings:","💹":":chart:","💺":":seat:","💻":":computer:","💼":":briefcase:","💽":":minidisc:","💾":":floppy_disk:","💿":":cd:","📀":":dvd:","📁":":file_folder:","📂":":open_file_folder:","📃":":page_with_curl:","📄":":page_facing_up:","📅":":date:","📆":":calendar:","📇":":card_index:","📈":":chart_with_upwards_trend:","📉":":chart_with_downwards_trend:","📊":":bar_chart:","📋":":clipboard:","📌":":pushpin:","📍":":round_pushpin:","📎":":paperclip:","📏":":straight_ruler:","📐":":triangular_ruler:","📑":":bookmark_tabs:","📒":":ledger:","📓":":notebook:","📔":":notebook_with_decorative_cover:","📕":":closed_book:","📖":":book:","📗":":green_book:","📘":":blue_book:","📙":":orange_book:","📚":":books:","📛":":name_badge:","📜":":scroll:","📝":":memo:","📞":":telephone_receiver:","📟":":pager:","📠":":fax:","📡":":satellite_antenna:","📢":":loudspeaker:","📣":":mega:","📤":":outbox_tray:","📥":":inbox_tray:","📦":":package:","📧":":e-mail:","📨":":incoming_envelope:","📩":":envelope_with_arrow:","📪":":mailbox_closed:","📫":":mailbox:","📬":":mailbox_with_mail:","📭":":mailbox_with_no_mail:","📮":":postbox:","📯":":postal_horn:","📰":":newspaper:","📱":":iphone:","📲":":calling:","📳":":vibration_mode:","📴":":mobile_phone_off:","📵":":no_mobile_phones:","📶":":signal_strength:","📷":":camera:","📸":":camera_with_flash:","📹":":video_camera:","📺":":tv:","📻":":radio:","📼":":vhs:","📽":":film_projector:","📿":":prayer_beads:","🔀":":twisted_rightwards_arrows:","🔁":":repeat:","🔂":":repeat_one:","🔃":":arrows_clockwise:","🔄":":arrows_counterclockwise:","🔅":":low_brightness:","🔆":":high_brightness:","🔇":":mute:","🔈":":speaker:","🔉":":sound:","🔊":":loud_sound:","🔋":":battery:","🔌":":electric_plug:","🔍":":mag:","🔎":":mag_right:","🔏":":lock_with_ink_pen:","🔐":":closed_lock_with_key:","🔑":":key:","🔒":":lock:","🔓":":unlock:","🔔":":bell:","🔕":":no_bell:","🔖":":bookmark:","🔗":":link:","🔘":":radio_button:","🔙":":back:","🔚":":end:","🔛":":on:","🔜":":soon:","🔝":":top:","🔞":":underage:","🔟":":keycap_ten:","🔠":":capital_abcd:","🔡":":abcd:","🔢":":1234:","🔣":":symbols:","🔤":":abc:","🔥":":fire:","🔦":":flashlight:","🔧":":wrench:","🔨":":hammer:","🔩":":nut_and_bolt:","🔪":":hocho:","🔫":":gun:","🔬":":microscope:","🔭":":telescope:","🔮":":crystal_ball:","🔯":":six_pointed_star:","🔰":":beginner:","🔱":":trident:","🔲":":black_square_button:","🔳":":white_square_button:","🔴":":red_circle:","🔵":":large_blue_circle:","🔶":":large_orange_diamond:","🔷":":large_blue_diamond:","🔸":":small_orange_diamond:","🔹":":small_blue_diamond:","🔺":":small_red_triangle:","🔻":":small_red_triangle_down:","🔼":":arrow_up_small:","🔽":":arrow_down_small:","🕉":":om_symbol:","🕊":":dove_of_peace:","🕋":":kaaba:","🕌":":mosque:","🕍":":synagogue:","🕎":":menorah_with_nine_branches:","🕐":":clock1:","🕑":":clock2:","🕒":":clock3:","🕓":":clock4:","🕔":":clock5:","🕕":":clock6:","🕖":":clock7:","🕗":":clock8:","🕘":":clock9:","🕙":":clock10:","🕚":":clock11:","🕛":":clock12:","🕜":":clock130:","🕝":":clock230:","🕞":":clock330:","🕟":":clock430:","🕠":":clock530:","🕡":":clock630:","🕢":":clock730:","🕣":":clock830:","🕤":":clock930:","🕥":":clock1030:","🕦":":clock1130:","🕧":":clock1230:","🕯":":candle:","🕰":":mantelpiece_clock:","🕳":":hole:","🕴🏻":":man_in_business_suit_levitating::skin-tone-1:","🕴🏼":":man_in_business_suit_levitating::skin-tone-2:","🕴🏽":":man_in_business_suit_levitating::skin-tone-3:","🕴🏾":":man_in_business_suit_levitating::skin-tone-4:","🕴🏿":":man_in_business_suit_levitating::skin-tone-5:","🕴":":man_in_business_suit_levitating:","🕵🏻":":sleuth_or_spy::skin-tone-1:","🕵🏼":":sleuth_or_spy::skin-tone-2:","🕵🏽":":sleuth_or_spy::skin-tone-3:","🕵🏾":":sleuth_or_spy::skin-tone-4:","🕵🏿":":sleuth_or_spy::skin-tone-5:","🕵️":":sleuth_or_spy:","🕵":":sleuth_or_spy:","🕶":":dark_sunglasses:","🕷":":spider:","🕸":":spider_web:","🕹":":joystick:","🕺🏻":":man_dancing::skin-tone-1:","🕺🏼":":man_dancing::skin-tone-2:","🕺🏽":":man_dancing::skin-tone-3:","🕺🏾":":man_dancing::skin-tone-4:","🕺🏿":":man_dancing::skin-tone-5:","🕺":":man_dancing:","🖇":":linked_paperclips:","🖊":":lower_left_ballpoint_pen:","🖋":":lower_left_fountain_pen:","🖌":":lower_left_paintbrush:","🖍":":lower_left_crayon:","🖐🏻":":raised_hand_with_fingers_splayed::skin-tone-1:","🖐🏼":":raised_hand_with_fingers_splayed::skin-tone-2:","🖐🏽":":raised_hand_with_fingers_splayed::skin-tone-3:","🖐🏾":":raised_hand_with_fingers_splayed::skin-tone-4:","🖐🏿":":raised_hand_with_fingers_splayed::skin-tone-5:","🖐":":raised_hand_with_fingers_splayed:","🖕🏻":":middle_finger::skin-tone-1:","🖕🏼":":middle_finger::skin-tone-2:","🖕🏽":":middle_finger::skin-tone-3:","🖕🏾":":middle_finger::skin-tone-4:","🖕🏿":":middle_finger::skin-tone-5:","🖕":":middle_finger:","🖖🏻":":spock-hand::skin-tone-1:","🖖🏼":":spock-hand::skin-tone-2:","🖖🏽":":spock-hand::skin-tone-3:","🖖🏾":":spock-hand::skin-tone-4:","🖖🏿":":spock-hand::skin-tone-5:","🖖":":spock-hand:","🖤":":black_heart:","🖥":":desktop_computer:","🖨":":printer:","🖱":":three_button_mouse:","🖲":":trackball:","🖼":":frame_with_picture:","🗂":":card_index_dividers:","🗃":":card_file_box:","🗄":":file_cabinet:","🗑":":wastebasket:","🗒":":spiral_note_pad:","🗓":":spiral_calendar_pad:","🗜":":compression:","🗝":":old_key:","🗞":":rolled_up_newspaper:","🗡":":dagger_knife:","🗣":":speaking_head_in_silhouette:","🗨":":left_speech_bubble:","🗯":":right_anger_bubble:","🗳":":ballot_box_with_ballot:","🗺":":world_map:","🗻":":mount_fuji:","🗼":":tokyo_tower:","🗽":":statue_of_liberty:","🗾":":japan:","🗿":":moyai:","😀":":grinning:","😁":":grin:","😂":":joy:","😃":":smiley:","😄":":smile:","😅":":sweat_smile:","😆":":laughing:","😇":":innocent:","😈":":smiling_imp:","😉":":wink:","😊":":blush:","😋":":yum:","😌":":relieved:","😍":":heart_eyes:","😎":":sunglasses:","😏":":smirk:","😐":":neutral_face:","😑":":expressionless:","😒":":unamused:","😓":":sweat:","😔":":pensive:","😕":":confused:","😖":":confounded:","😗":":kissing:","😘":":kissing_heart:","😙":":kissing_smiling_eyes:","😚":":kissing_closed_eyes:","😛":":stuck_out_tongue:","😜":":stuck_out_tongue_winking_eye:","😝":":stuck_out_tongue_closed_eyes:","😞":":disappointed:","😟":":worried:","😠":":angry:","😡":":rage:","😢":":cry:","😣":":persevere:","😤":":triumph:","😥":":disappointed_relieved:","😦":":frowning:","😧":":anguished:","😨":":fearful:","😩":":weary:","😪":":sleepy:","😫":":tired_face:","😬":":grimacing:","😭":":sob:","😮":":open_mouth:","😯":":hushed:","😰":":cold_sweat:","😱":":scream:","😲":":astonished:","😳":":flushed:","😴":":sleeping:","😵":":dizzy_face:","😶":":no_mouth:","😷":":mask:","😸":":smile_cat:","😹":":joy_cat:","😺":":smiley_cat:","😻":":heart_eyes_cat:","😼":":smirk_cat:","😽":":kissing_cat:","😾":":pouting_cat:","😿":":crying_cat_face:","🙀":":scream_cat:","🙁":":slightly_frowning_face:","🙂":":slightly_smiling_face:","🙃":":upside_down_face:","🙄":":face_with_rolling_eyes:","🙅🏻":":no_good::skin-tone-1:","🙅🏼":":no_good::skin-tone-2:","🙅🏽":":no_good::skin-tone-3:","🙅🏾":":no_good::skin-tone-4:","🙅🏿":":no_good::skin-tone-5:","🙅":":no_good:","🙆🏻":":ok_woman::skin-tone-1:","🙆🏼":":ok_woman::skin-tone-2:","🙆🏽":":ok_woman::skin-tone-3:","🙆🏾":":ok_woman::skin-tone-4:","🙆🏿":":ok_woman::skin-tone-5:","🙆":":ok_woman:","🙇🏻":":bow::skin-tone-1:","🙇🏼":":bow::skin-tone-2:","🙇🏽":":bow::skin-tone-3:","🙇🏾":":bow::skin-tone-4:","🙇🏿":":bow::skin-tone-5:","🙇":":bow:","🙈":":see_no_evil:","🙉":":hear_no_evil:","🙊":":speak_no_evil:","🙋🏻":":raising_hand::skin-tone-1:","🙋🏼":":raising_hand::skin-tone-2:","🙋🏽":":raising_hand::skin-tone-3:","🙋🏾":":raising_hand::skin-tone-4:","🙋🏿":":raising_hand::skin-tone-5:","🙋":":raising_hand:","🙌🏻":":raised_hands::skin-tone-1:","🙌🏼":":raised_hands::skin-tone-2:","🙌🏽":":raised_hands::skin-tone-3:","🙌🏾":":raised_hands::skin-tone-4:","🙌🏿":":raised_hands::skin-tone-5:","🙌":":raised_hands:","🙍🏻":":person_frowning::skin-tone-1:","🙍🏼":":person_frowning::skin-tone-2:","🙍🏽":":person_frowning::skin-tone-3:","🙍🏾":":person_frowning::skin-tone-4:","🙍🏿":":person_frowning::skin-tone-5:","🙍":":person_frowning:","🙎🏻":":person_with_pouting_face::skin-tone-1:","🙎🏼":":person_with_pouting_face::skin-tone-2:","🙎🏽":":person_with_pouting_face::skin-tone-3:","🙎🏾":":person_with_pouting_face::skin-tone-4:","🙎🏿":":person_with_pouting_face::skin-tone-5:","🙎":":person_with_pouting_face:","🙏🏻":":pray::skin-tone-1:","🙏🏼":":pray::skin-tone-2:","🙏🏽":":pray::skin-tone-3:","🙏🏾":":pray::skin-tone-4:","🙏🏿":":pray::skin-tone-5:","🙏":":pray:","🚀":":rocket:","🚁":":helicopter:","🚂":":steam_locomotive:","🚃":":railway_car:","🚄":":bullettrain_side:","🚅":":bullettrain_front:","🚆":":train2:","🚇":":metro:","🚈":":light_rail:","🚉":":station:","🚊":":tram:","🚋":":train:","🚌":":bus:","🚍":":oncoming_bus:","🚎":":trolleybus:","🚏":":busstop:","🚐":":minibus:","🚑":":ambulance:","🚒":":fire_engine:","🚓":":police_car:","🚔":":oncoming_police_car:","🚕":":taxi:","🚖":":oncoming_taxi:","🚗":":car:","🚘":":oncoming_automobile:","🚙":":blue_car:","🚚":":truck:","🚛":":articulated_lorry:","🚜":":tractor:","🚝":":monorail:","🚞":":mountain_railway:","🚟":":suspension_railway:","🚠":":mountain_cableway:","🚡":":aerial_tramway:","🚢":":ship:","🚣🏻":":rowboat::skin-tone-1:","🚣🏼":":rowboat::skin-tone-2:","🚣🏽":":rowboat::skin-tone-3:","🚣🏾":":rowboat::skin-tone-4:","🚣🏿":":rowboat::skin-tone-5:","🚣":":rowboat:","🚤":":speedboat:","🚥":":traffic_light:","🚦":":vertical_traffic_light:","🚧":":construction:","🚨":":rotating_light:","🚩":":triangular_flag_on_post:","🚪":":door:","🚫":":no_entry_sign:","🚬":":smoking:","🚭":":no_smoking:","🚮":":put_litter_in_its_place:","🚯":":do_not_litter:","🚰":":potable_water:","🚱":":non-potable_water:","🚲":":bike:","🚳":":no_bicycles:","🚴🏻":":bicyclist::skin-tone-1:","🚴🏼":":bicyclist::skin-tone-2:","🚴🏽":":bicyclist::skin-tone-3:","🚴🏾":":bicyclist::skin-tone-4:","🚴🏿":":bicyclist::skin-tone-5:","🚴":":bicyclist:","🚵🏻":":mountain_bicyclist::skin-tone-1:","🚵🏼":":mountain_bicyclist::skin-tone-2:","🚵🏽":":mountain_bicyclist::skin-tone-3:","🚵🏾":":mountain_bicyclist::skin-tone-4:","🚵🏿":":mountain_bicyclist::skin-tone-5:","🚵":":mountain_bicyclist:","🚶🏻":":walking::skin-tone-1:","🚶🏼":":walking::skin-tone-2:","🚶🏽":":walking::skin-tone-3:","🚶🏾":":walking::skin-tone-4:","🚶🏿":":walking::skin-tone-5:","🚶":":walking:","🚷":":no_pedestrians:","🚸":":children_crossing:","🚹":":mens:","🚺":":womens:","🚻":":restroom:","🚼":":baby_symbol:","🚽":":toilet:","🚾":":wc:","🚿":":shower:","🛀🏻":":bath::skin-tone-1:","🛀🏼":":bath::skin-tone-2:","🛀🏽":":bath::skin-tone-3:","🛀🏾":":bath::skin-tone-4:","🛀🏿":":bath::skin-tone-5:","🛀":":bath:","🛁":":bathtub:","🛂":":passport_control:","🛃":":customs:","🛄":":baggage_claim:","🛅":":left_luggage:","🛋":":couch_and_lamp:","🛌🏻":":sleeping_accommodation::skin-tone-1:","🛌🏼":":sleeping_accommodation::skin-tone-2:","🛌🏽":":sleeping_accommodation::skin-tone-3:","🛌🏾":":sleeping_accommodation::skin-tone-4:","🛌🏿":":sleeping_accommodation::skin-tone-5:","🛌":":sleeping_accommodation:","🛍":":shopping_bags:","🛎":":bellhop_bell:","🛏":":bed:","🛐":":place_of_worship:","🛑":":octagonal_sign:","🛒":":shopping_trolley:","🛠":":hammer_and_wrench:","🛡":":shield:","🛢":":oil_drum:","🛣":":motorway:","🛤":":railway_track:","🛥":":motor_boat:","🛩":":small_airplane:","🛫":":airplane_departure:","🛬":":airplane_arriving:","🛰":":satellite:","🛳":":passenger_ship:","🛴":":scooter:","🛵":":motor_scooter:","🛶":":canoe:","🤐":":zipper_mouth_face:","🤑":":money_mouth_face:","🤒":":face_with_thermometer:","🤓":":nerd_face:","🤔":":thinking_face:","🤕":":face_with_head_bandage:","🤖":":robot_face:","🤗":":hugging_face:","🤘🏻":":the_horns::skin-tone-1:","🤘🏼":":the_horns::skin-tone-2:","🤘🏽":":the_horns::skin-tone-3:","🤘🏾":":the_horns::skin-tone-4:","🤘🏿":":the_horns::skin-tone-5:","🤘":":the_horns:","🤙🏻":":call_me_hand::skin-tone-1:","🤙🏼":":call_me_hand::skin-tone-2:","🤙🏽":":call_me_hand::skin-tone-3:","🤙🏾":":call_me_hand::skin-tone-4:","🤙🏿":":call_me_hand::skin-tone-5:","🤙":":call_me_hand:","🤚🏻":":raised_back_of_hand::skin-tone-1:","🤚🏼":":raised_back_of_hand::skin-tone-2:","🤚🏽":":raised_back_of_hand::skin-tone-3:","🤚🏾":":raised_back_of_hand::skin-tone-4:","🤚🏿":":raised_back_of_hand::skin-tone-5:","🤚":":raised_back_of_hand:","🤛🏻":":left-facing_fist::skin-tone-1:","🤛🏼":":left-facing_fist::skin-tone-2:","🤛🏽":":left-facing_fist::skin-tone-3:","🤛🏾":":left-facing_fist::skin-tone-4:","🤛🏿":":left-facing_fist::skin-tone-5:","🤛":":left-facing_fist:","🤜🏻":":right-facing_fist::skin-tone-1:","🤜🏼":":right-facing_fist::skin-tone-2:","🤜🏽":":right-facing_fist::skin-tone-3:","🤜🏾":":right-facing_fist::skin-tone-4:","🤜🏿":":right-facing_fist::skin-tone-5:","🤜":":right-facing_fist:","🤝":":handshake:","🤞🏻":":hand_with_index_and_middle_fingers_crossed::skin-tone-1:","🤞🏼":":hand_with_index_and_middle_fingers_crossed::skin-tone-2:","🤞🏽":":hand_with_index_and_middle_fingers_crossed::skin-tone-3:","🤞🏾":":hand_with_index_and_middle_fingers_crossed::skin-tone-4:","🤞🏿":":hand_with_index_and_middle_fingers_crossed::skin-tone-5:","🤞":":hand_with_index_and_middle_fingers_crossed:","🤠":":face_with_cowboy_hat:","🤡":":clown_face:","🤢":":nauseated_face:","🤣":":rolling_on_the_floor_laughing:","🤤":":drooling_face:","🤥":":lying_face:","🤦🏻":":face_palm::skin-tone-1:","🤦🏼":":face_palm::skin-tone-2:","🤦🏽":":face_palm::skin-tone-3:","🤦🏾":":face_palm::skin-tone-4:","🤦🏿":":face_palm::skin-tone-5:","🤦":":face_palm:","🤧":":sneezing_face:","🤰🏻":":pregnant_woman::skin-tone-1:","🤰🏼":":pregnant_woman::skin-tone-2:","🤰🏽":":pregnant_woman::skin-tone-3:","🤰🏾":":pregnant_woman::skin-tone-4:","🤰🏿":":pregnant_woman::skin-tone-5:","🤰":":pregnant_woman:","🤳🏻":":selfie::skin-tone-1:","🤳🏼":":selfie::skin-tone-2:","🤳🏽":":selfie::skin-tone-3:","🤳🏾":":selfie::skin-tone-4:","🤳🏿":":selfie::skin-tone-5:","🤳":":selfie:","🤴🏻":":prince::skin-tone-1:","🤴🏼":":prince::skin-tone-2:","🤴🏽":":prince::skin-tone-3:","🤴🏾":":prince::skin-tone-4:","🤴🏿":":prince::skin-tone-5:","🤴":":prince:","🤵🏻":":man_in_tuxedo::skin-tone-1:","🤵🏼":":man_in_tuxedo::skin-tone-2:","🤵🏽":":man_in_tuxedo::skin-tone-3:","🤵🏾":":man_in_tuxedo::skin-tone-4:","🤵🏿":":man_in_tuxedo::skin-tone-5:","🤵":":man_in_tuxedo:","🤶🏻":":mother_christmas::skin-tone-1:","🤶🏼":":mother_christmas::skin-tone-2:","🤶🏽":":mother_christmas::skin-tone-3:","🤶🏾":":mother_christmas::skin-tone-4:","🤶🏿":":mother_christmas::skin-tone-5:","🤶":":mother_christmas:","🤷🏻":":shrug::skin-tone-1:","🤷🏼":":shrug::skin-tone-2:","🤷🏽":":shrug::skin-tone-3:","🤷🏾":":shrug::skin-tone-4:","🤷🏿":":shrug::skin-tone-5:","🤷":":shrug:","🤸🏻":":person_doing_cartwheel::skin-tone-1:","🤸🏼":":person_doing_cartwheel::skin-tone-2:","🤸🏽":":person_doing_cartwheel::skin-tone-3:","🤸🏾":":person_doing_cartwheel::skin-tone-4:","🤸🏿":":person_doing_cartwheel::skin-tone-5:","🤸":":person_doing_cartwheel:","🤹🏻":":juggling::skin-tone-1:","🤹🏼":":juggling::skin-tone-2:","🤹🏽":":juggling::skin-tone-3:","🤹🏾":":juggling::skin-tone-4:","🤹🏿":":juggling::skin-tone-5:","🤹":":juggling:","🤺":":fencer:","🤼":":wrestlers:","🤽🏻":":water_polo::skin-tone-1:","🤽🏼":":water_polo::skin-tone-2:","🤽🏽":":water_polo::skin-tone-3:","🤽🏾":":water_polo::skin-tone-4:","🤽🏿":":water_polo::skin-tone-5:","🤽":":water_polo:","🤾🏻":":handball::skin-tone-1:","🤾🏼":":handball::skin-tone-2:","🤾🏽":":handball::skin-tone-3:","🤾🏾":":handball::skin-tone-4:","🤾🏿":":handball::skin-tone-5:","🤾":":handball:","🥀":":wilted_flower:","🥁":":drum_with_drumsticks:","🥂":":clinking_glasses:","🥃":":tumbler_glass:","🥄":":spoon:","🥅":":goal_net:","🥇":":first_place_medal:","🥈":":second_place_medal:","🥉":":third_place_medal:","🥊":":boxing_glove:","🥋":":martial_arts_uniform:","🥐":":croissant:","🥑":":avocado:","🥒":":cucumber:","🥓":":bacon:","🥔":":potato:","🥕":":carrot:","🥖":":baguette_bread:","🥗":":green_salad:","🥘":":shallow_pan_of_food:","🥙":":stuffed_flatbread:","🥚":":egg:","🥛":":glass_of_milk:","🥜":":peanuts:","🥝":":kiwifruit:","🥞":":pancakes:","🦀":":crab:","🦁":":lion_face:","🦂":":scorpion:","🦃":":turkey:","🦄":":unicorn_face:","🦅":":eagle:","🦆":":duck:","🦇":":bat:","🦈":":shark:","🦉":":owl:","🦊":":fox_face:","🦋":":butterfly:","🦌":":deer:","🦍":":gorilla:","🦎":":lizard:","🦏":":rhinoceros:","🦐":":shrimp:","🦑":":squid:","🧀":":cheese_wedge:","#️⃣":":hash:","#⃣":":hash:","*️⃣":":keycap_star:","*⃣":":keycap_star:","0️⃣":":zero:","0⃣":":zero:","1️⃣":":one:","1⃣":":one:","2️⃣":":two:","2⃣":":two:","3️⃣":":three:","3⃣":":three:","4️⃣":":four:","4⃣":":four:","5️⃣":":five:","5⃣":":five:","6️⃣":":six:","6⃣":":six:","7️⃣":":seven:","7⃣":":seven:","8️⃣":":eight:","8⃣":":eight:","9️⃣":":nine:","9⃣":":nine:","🇦🇨":":flag-ac:","🇦🇩":":flag-ad:","🇦🇪":":flag-ae:","🇦🇫":":flag-af:","🇦🇬":":flag-ag:","🇦🇮":":flag-ai:","🇦🇱":":flag-al:","🇦🇲":":flag-am:","🇦🇴":":flag-ao:","🇦🇶":":flag-aq:","🇦🇷":":flag-ar:","🇦🇸":":flag-as:","🇦🇹":":flag-at:","🇦🇺":":flag-au:","🇦🇼":":flag-aw:","🇦🇽":":flag-ax:","🇦🇿":":flag-az:","🇧🇦":":flag-ba:","🇧🇧":":flag-bb:","🇧🇩":":flag-bd:","🇧🇪":":flag-be:","🇧🇫":":flag-bf:","🇧🇬":":flag-bg:","🇧🇭":":flag-bh:","🇧🇮":":flag-bi:","🇧🇯":":flag-bj:","🇧🇱":":flag-bl:","🇧🇲":":flag-bm:","🇧🇳":":flag-bn:","🇧🇴":":flag-bo:","🇧🇶":":flag-bq:","🇧🇷":":flag-br:","🇧🇸":":flag-bs:","🇧🇹":":flag-bt:","🇧🇻":":flag-bv:","🇧🇼":":flag-bw:","🇧🇾":":flag-by:","🇧🇿":":flag-bz:","🇨🇦":":flag-ca:","🇨🇨":":flag-cc:","🇨🇩":":flag-cd:","🇨🇫":":flag-cf:","🇨🇬":":flag-cg:","🇨🇭":":flag-ch:","🇨🇮":":flag-ci:","🇨🇰":":flag-ck:","🇨🇱":":flag-cl:","🇨🇲":":flag-cm:","🇨🇳":":flag-cn:","🇨🇴":":flag-co:","🇨🇵":":flag-cp:","🇨🇷":":flag-cr:","🇨🇺":":flag-cu:","🇨🇻":":flag-cv:","🇨🇼":":flag-cw:","🇨🇽":":flag-cx:","🇨🇾":":flag-cy:","🇨🇿":":flag-cz:","🇩🇪":":flag-de:","🇩🇬":":flag-dg:","🇩🇯":":flag-dj:","🇩🇰":":flag-dk:","🇩🇲":":flag-dm:","🇩🇴":":flag-do:","🇩🇿":":flag-dz:","🇪🇦":":flag-ea:","🇪🇨":":flag-ec:","🇪🇪":":flag-ee:","🇪🇬":":flag-eg:","🇪🇭":":flag-eh:","🇪🇷":":flag-er:","🇪🇸":":flag-es:","🇪🇹":":flag-et:","🇪🇺":":flag-eu:","🇫🇮":":flag-fi:","🇫🇯":":flag-fj:","🇫🇰":":flag-fk:","🇫🇲":":flag-fm:","🇫🇴":":flag-fo:","🇫🇷":":flag-fr:","🇬🇦":":flag-ga:","🇬🇧":":flag-gb:","🇬🇩":":flag-gd:","🇬🇪":":flag-ge:","🇬🇫":":flag-gf:","🇬🇬":":flag-gg:","🇬🇭":":flag-gh:","🇬🇮":":flag-gi:","🇬🇱":":flag-gl:","🇬🇲":":flag-gm:","🇬🇳":":flag-gn:","🇬🇵":":flag-gp:","🇬🇶":":flag-gq:","🇬🇷":":flag-gr:","🇬🇸":":flag-gs:","🇬🇹":":flag-gt:","🇬🇺":":flag-gu:","🇬🇼":":flag-gw:","🇬🇾":":flag-gy:","🇭🇰":":flag-hk:","🇭🇲":":flag-hm:","🇭🇳":":flag-hn:","🇭🇷":":flag-hr:","🇭🇹":":flag-ht:","🇭🇺":":flag-hu:","🇮🇨":":flag-ic:","🇮🇩":":flag-id:","🇮🇪":":flag-ie:","🇮🇱":":flag-il:","🇮🇲":":flag-im:","🇮🇳":":flag-in:","🇮🇴":":flag-io:","🇮🇶":":flag-iq:","🇮🇷":":flag-ir:","🇮🇸":":flag-is:","🇮🇹":":flag-it:","🇯🇪":":flag-je:","🇯🇲":":flag-jm:","🇯🇴":":flag-jo:","🇯🇵":":flag-jp:","🇰🇪":":flag-ke:","🇰🇬":":flag-kg:","🇰🇭":":flag-kh:","🇰🇮":":flag-ki:","🇰🇲":":flag-km:","🇰🇳":":flag-kn:","🇰🇵":":flag-kp:","🇰🇷":":flag-kr:","🇰🇼":":flag-kw:","🇰🇾":":flag-ky:","🇰🇿":":flag-kz:","🇱🇦":":flag-la:","🇱🇧":":flag-lb:","🇱🇨":":flag-lc:","🇱🇮":":flag-li:","🇱🇰":":flag-lk:","🇱🇷":":flag-lr:","🇱🇸":":flag-ls:","🇱🇹":":flag-lt:","🇱🇺":":flag-lu:","🇱🇻":":flag-lv:","🇱🇾":":flag-ly:","🇲🇦":":flag-ma:","🇲🇨":":flag-mc:","🇲🇩":":flag-md:","🇲🇪":":flag-me:","🇲🇫":":flag-mf:","🇲🇬":":flag-mg:","🇲🇭":":flag-mh:","🇲🇰":":flag-mk:","🇲🇱":":flag-ml:","🇲🇲":":flag-mm:","🇲🇳":":flag-mn:","🇲🇴":":flag-mo:","🇲🇵":":flag-mp:","🇲🇶":":flag-mq:","🇲🇷":":flag-mr:","🇲🇸":":flag-ms:","🇲🇹":":flag-mt:","🇲🇺":":flag-mu:","🇲🇻":":flag-mv:","🇲🇼":":flag-mw:","🇲🇽":":flag-mx:","🇲🇾":":flag-my:","🇲🇿":":flag-mz:","🇳🇦":":flag-na:","🇳🇨":":flag-nc:","🇳🇪":":flag-ne:","🇳🇫":":flag-nf:","🇳🇬":":flag-ng:","🇳🇮":":flag-ni:","🇳🇱":":flag-nl:","🇳🇴":":flag-no:","🇳🇵":":flag-np:","🇳🇷":":flag-nr:","🇳🇺":":flag-nu:","🇳🇿":":flag-nz:","🇴🇲":":flag-om:","🇵🇦":":flag-pa:","🇵🇪":":flag-pe:","🇵🇫":":flag-pf:","🇵🇬":":flag-pg:","🇵🇭":":flag-ph:","🇵🇰":":flag-pk:","🇵🇱":":flag-pl:","🇵🇲":":flag-pm:","🇵🇳":":flag-pn:","🇵🇷":":flag-pr:","🇵🇸":":flag-ps:","🇵🇹":":flag-pt:","🇵🇼":":flag-pw:","🇵🇾":":flag-py:","🇶🇦":":flag-qa:","🇷🇪":":flag-re:","🇷🇴":":flag-ro:","🇷🇸":":flag-rs:","🇷🇺":":flag-ru:","🇷🇼":":flag-rw:","🇸🇦":":flag-sa:","🇸🇧":":flag-sb:","🇸🇨":":flag-sc:","🇸🇩":":flag-sd:","🇸🇪":":flag-se:","🇸🇬":":flag-sg:","🇸🇭":":flag-sh:","🇸🇮":":flag-si:","🇸🇯":":flag-sj:","🇸🇰":":flag-sk:","🇸🇱":":flag-sl:","🇸🇲":":flag-sm:","🇸🇳":":flag-sn:","🇸🇴":":flag-so:","🇸🇷":":flag-sr:","🇸🇸":":flag-ss:","🇸🇹":":flag-st:","🇸🇻":":flag-sv:","🇸🇽":":flag-sx:","🇸🇾":":flag-sy:","🇸🇿":":flag-sz:","🇹🇦":":flag-ta:","🇹🇨":":flag-tc:","🇹🇩":":flag-td:","🇹🇫":":flag-tf:","🇹🇬":":flag-tg:","🇹🇭":":flag-th:","🇹🇯":":flag-tj:","🇹🇰":":flag-tk:","🇹🇱":":flag-tl:","🇹🇲":":flag-tm:","🇹🇳":":flag-tn:","🇹🇴":":flag-to:","🇹🇷":":flag-tr:","🇹🇹":":flag-tt:","🇹🇻":":flag-tv:","🇹🇼":":flag-tw:","🇹🇿":":flag-tz:","🇺🇦":":flag-ua:","🇺🇬":":flag-ug:","🇺🇲":":flag-um:","🇺🇳":":flag-un:","🇺🇸":":flag-us:","🇺🇾":":flag-uy:","🇺🇿":":flag-uz:","🇻🇦":":flag-va:","🇻🇨":":flag-vc:","🇻🇪":":flag-ve:","🇻🇬":":flag-vg:","🇻🇮":":flag-vi:","🇻🇳":":flag-vn:","🇻🇺":":flag-vu:","🇼🇫":":flag-wf:","🇼🇸":":flag-ws:","🇽🇰":":flag-xk:","🇾🇪":":flag-ye:","🇾🇹":":flag-yt:","🇿🇦":":flag-za:","🇿🇲":":flag-zm:","🇿🇼":":flag-zw:","👨🏻‍🌾":":male-farmer::skin-tone-1:","👨🏼‍🌾":":male-farmer::skin-tone-2:","👨🏽‍🌾":":male-farmer::skin-tone-3:","👨🏾‍🌾":":male-farmer::skin-tone-4:","👨🏿‍🌾":":male-farmer::skin-tone-5:","👨‍🌾":":male-farmer:","👨🏻‍🍳":":male-cook::skin-tone-1:","👨🏼‍🍳":":male-cook::skin-tone-2:","👨🏽‍🍳":":male-cook::skin-tone-3:","👨🏾‍🍳":":male-cook::skin-tone-4:","👨🏿‍🍳":":male-cook::skin-tone-5:","👨‍🍳":":male-cook:","👨🏻‍🎓":":male-student::skin-tone-1:","👨🏼‍🎓":":male-student::skin-tone-2:","👨🏽‍🎓":":male-student::skin-tone-3:","👨🏾‍🎓":":male-student::skin-tone-4:","👨🏿‍🎓":":male-student::skin-tone-5:","👨‍🎓":":male-student:","👨🏻‍🎤":":male-singer::skin-tone-1:","👨🏼‍🎤":":male-singer::skin-tone-2:","👨🏽‍🎤":":male-singer::skin-tone-3:","👨🏾‍🎤":":male-singer::skin-tone-4:","👨🏿‍🎤":":male-singer::skin-tone-5:","👨‍🎤":":male-singer:","👨🏻‍🎨":":male-artist::skin-tone-1:","👨🏼‍🎨":":male-artist::skin-tone-2:","👨🏽‍🎨":":male-artist::skin-tone-3:","👨🏾‍🎨":":male-artist::skin-tone-4:","👨🏿‍🎨":":male-artist::skin-tone-5:","👨‍🎨":":male-artist:","👨🏻‍🏫":":male-teacher::skin-tone-1:","👨🏼‍🏫":":male-teacher::skin-tone-2:","👨🏽‍🏫":":male-teacher::skin-tone-3:","👨🏾‍🏫":":male-teacher::skin-tone-4:","👨🏿‍🏫":":male-teacher::skin-tone-5:","👨‍🏫":":male-teacher:","👨🏻‍🏭":":male-factory-worker::skin-tone-1:","👨🏼‍🏭":":male-factory-worker::skin-tone-2:","👨🏽‍🏭":":male-factory-worker::skin-tone-3:","👨🏾‍🏭":":male-factory-worker::skin-tone-4:","👨🏿‍🏭":":male-factory-worker::skin-tone-5:","👨‍🏭":":male-factory-worker:","👨‍👦":":man-boy:","👨‍👧":":man-girl:","👨🏻‍💻":":male-technologist::skin-tone-1:","👨🏼‍💻":":male-technologist::skin-tone-2:","👨🏽‍💻":":male-technologist::skin-tone-3:","👨🏾‍💻":":male-technologist::skin-tone-4:","👨🏿‍💻":":male-technologist::skin-tone-5:","👨‍💻":":male-technologist:","👨🏻‍💼":":male-office-worker::skin-tone-1:","👨🏼‍💼":":male-office-worker::skin-tone-2:","👨🏽‍💼":":male-office-worker::skin-tone-3:","👨🏾‍💼":":male-office-worker::skin-tone-4:","👨🏿‍💼":":male-office-worker::skin-tone-5:","👨‍💼":":male-office-worker:","👨🏻‍🔧":":male-mechanic::skin-tone-1:","👨🏼‍🔧":":male-mechanic::skin-tone-2:","👨🏽‍🔧":":male-mechanic::skin-tone-3:","👨🏾‍🔧":":male-mechanic::skin-tone-4:","👨🏿‍🔧":":male-mechanic::skin-tone-5:","👨‍🔧":":male-mechanic:","👨🏻‍🔬":":male-scientist::skin-tone-1:","👨🏼‍🔬":":male-scientist::skin-tone-2:","👨🏽‍🔬":":male-scientist::skin-tone-3:","👨🏾‍🔬":":male-scientist::skin-tone-4:","👨🏿‍🔬":":male-scientist::skin-tone-5:","👨‍🔬":":male-scientist:","👨🏻‍🚀":":male-astronaut::skin-tone-1:","👨🏼‍🚀":":male-astronaut::skin-tone-2:","👨🏽‍🚀":":male-astronaut::skin-tone-3:","👨🏾‍🚀":":male-astronaut::skin-tone-4:","👨🏿‍🚀":":male-astronaut::skin-tone-5:","👨‍🚀":":male-astronaut:","👨🏻‍🚒":":male-firefighter::skin-tone-1:","👨🏼‍🚒":":male-firefighter::skin-tone-2:","👨🏽‍🚒":":male-firefighter::skin-tone-3:","👨🏾‍🚒":":male-firefighter::skin-tone-4:","👨🏿‍🚒":":male-firefighter::skin-tone-5:","👨‍🚒":":male-firefighter:","👩🏻‍🌾":":female-farmer::skin-tone-1:","👩🏼‍🌾":":female-farmer::skin-tone-2:","👩🏽‍🌾":":female-farmer::skin-tone-3:","👩🏾‍🌾":":female-farmer::skin-tone-4:","👩🏿‍🌾":":female-farmer::skin-tone-5:","👩‍🌾":":female-farmer:","👩🏻‍🍳":":female-cook::skin-tone-1:","👩🏼‍🍳":":female-cook::skin-tone-2:","👩🏽‍🍳":":female-cook::skin-tone-3:","👩🏾‍🍳":":female-cook::skin-tone-4:","👩🏿‍🍳":":female-cook::skin-tone-5:","👩‍🍳":":female-cook:","👩🏻‍🎓":":female-student::skin-tone-1:","👩🏼‍🎓":":female-student::skin-tone-2:","👩🏽‍🎓":":female-student::skin-tone-3:","👩🏾‍🎓":":female-student::skin-tone-4:","👩🏿‍🎓":":female-student::skin-tone-5:","👩‍🎓":":female-student:","👩🏻‍🎤":":female-singer::skin-tone-1:","👩🏼‍🎤":":female-singer::skin-tone-2:","👩🏽‍🎤":":female-singer::skin-tone-3:","👩🏾‍🎤":":female-singer::skin-tone-4:","👩🏿‍🎤":":female-singer::skin-tone-5:","👩‍🎤":":female-singer:","👩🏻‍🎨":":female-artist::skin-tone-1:","👩🏼‍🎨":":female-artist::skin-tone-2:","👩🏽‍🎨":":female-artist::skin-tone-3:","👩🏾‍🎨":":female-artist::skin-tone-4:","👩🏿‍🎨":":female-artist::skin-tone-5:","👩‍🎨":":female-artist:","👩🏻‍🏫":":female-teacher::skin-tone-1:","👩🏼‍🏫":":female-teacher::skin-tone-2:","👩🏽‍🏫":":female-teacher::skin-tone-3:","👩🏾‍🏫":":female-teacher::skin-tone-4:","👩🏿‍🏫":":female-teacher::skin-tone-5:","👩‍🏫":":female-teacher:","👩🏻‍🏭":":female-factory-worker::skin-tone-1:","👩🏼‍🏭":":female-factory-worker::skin-tone-2:","👩🏽‍🏭":":female-factory-worker::skin-tone-3:","👩🏾‍🏭":":female-factory-worker::skin-tone-4:","👩🏿‍🏭":":female-factory-worker::skin-tone-5:","👩‍🏭":":female-factory-worker:","👩‍👦":":woman-boy:","👩‍👧":":woman-girl:","👩🏻‍💻":":female-technologist::skin-tone-1:","👩🏼‍💻":":female-technologist::skin-tone-2:","👩🏽‍💻":":female-technologist::skin-tone-3:","👩🏾‍💻":":female-technologist::skin-tone-4:","👩🏿‍💻":":female-technologist::skin-tone-5:","👩‍💻":":female-technologist:","👩🏻‍💼":":female-office-worker::skin-tone-1:","👩🏼‍💼":":female-office-worker::skin-tone-2:","👩🏽‍💼":":female-office-worker::skin-tone-3:","👩🏾‍💼":":female-office-worker::skin-tone-4:","👩🏿‍💼":":female-office-worker::skin-tone-5:","👩‍💼":":female-office-worker:","👩🏻‍🔧":":female-mechanic::skin-tone-1:","👩🏼‍🔧":":female-mechanic::skin-tone-2:","👩🏽‍🔧":":female-mechanic::skin-tone-3:","👩🏾‍🔧":":female-mechanic::skin-tone-4:","👩🏿‍🔧":":female-mechanic::skin-tone-5:","👩‍🔧":":female-mechanic:","👩🏻‍🔬":":female-scientist::skin-tone-1:","👩🏼‍🔬":":female-scientist::skin-tone-2:","👩🏽‍🔬":":female-scientist::skin-tone-3:","👩🏾‍🔬":":female-scientist::skin-tone-4:","👩🏿‍🔬":":female-scientist::skin-tone-5:","👩‍🔬":":female-scientist:","👩🏻‍🚀":":female-astronaut::skin-tone-1:","👩🏼‍🚀":":female-astronaut::skin-tone-2:","👩🏽‍🚀":":female-astronaut::skin-tone-3:","👩🏾‍🚀":":female-astronaut::skin-tone-4:","👩🏿‍🚀":":female-astronaut::skin-tone-5:","👩‍🚀":":female-astronaut:","👩🏻‍🚒":":female-firefighter::skin-tone-1:","👩🏼‍🚒":":female-firefighter::skin-tone-2:","👩🏽‍🚒":":female-firefighter::skin-tone-3:","👩🏾‍🚒":":female-firefighter::skin-tone-4:","👩🏿‍🚒":":female-firefighter::skin-tone-5:","👩‍🚒":":female-firefighter:","🏃🏻‍♀️":":woman-running::skin-tone-1:","🏃🏼‍♀️":":woman-running::skin-tone-2:","🏃🏽‍♀️":":woman-running::skin-tone-3:","🏃🏾‍♀️":":woman-running::skin-tone-4:","🏃🏿‍♀️":":woman-running::skin-tone-5:","🏃‍♀️":":woman-running:","🏃🏻‍♂️":":man-running::skin-tone-1:","🏃🏼‍♂️":":man-running::skin-tone-2:","🏃🏽‍♂️":":man-running::skin-tone-3:","🏃🏾‍♂️":":man-running::skin-tone-4:","🏃🏿‍♂️":":man-running::skin-tone-5:","🏃‍♂️":":man-running:","🏄🏻‍♀️":":woman-surfing::skin-tone-1:","🏄🏼‍♀️":":woman-surfing::skin-tone-2:","🏄🏽‍♀️":":woman-surfing::skin-tone-3:","🏄🏾‍♀️":":woman-surfing::skin-tone-4:","🏄🏿‍♀️":":woman-surfing::skin-tone-5:","🏄‍♀️":":woman-surfing:","🏄🏻‍♂️":":man-surfing::skin-tone-1:","🏄🏼‍♂️":":man-surfing::skin-tone-2:","🏄🏽‍♂️":":man-surfing::skin-tone-3:","🏄🏾‍♂️":":man-surfing::skin-tone-4:","🏄🏿‍♂️":":man-surfing::skin-tone-5:","🏄‍♂️":":man-surfing:","🏊🏻‍♀️":":woman-swimming::skin-tone-1:","🏊🏼‍♀️":":woman-swimming::skin-tone-2:","🏊🏽‍♀️":":woman-swimming::skin-tone-3:","🏊🏾‍♀️":":woman-swimming::skin-tone-4:","🏊🏿‍♀️":":woman-swimming::skin-tone-5:","🏊‍♀️":":woman-swimming:","🏊🏻‍♂️":":man-swimming::skin-tone-1:","🏊🏼‍♂️":":man-swimming::skin-tone-2:","🏊🏽‍♂️":":man-swimming::skin-tone-3:","🏊🏾‍♂️":":man-swimming::skin-tone-4:","🏊🏿‍♂️":":man-swimming::skin-tone-5:","🏊‍♂️":":man-swimming:","🏋🏻‍♀️":":woman-lifting-weights::skin-tone-1:","🏋🏼‍♀️":":woman-lifting-weights::skin-tone-2:","🏋🏽‍♀️":":woman-lifting-weights::skin-tone-3:","🏋🏾‍♀️":":woman-lifting-weights::skin-tone-4:","🏋🏿‍♀️":":woman-lifting-weights::skin-tone-5:","🏋️‍♀️":":woman-lifting-weights:","🏋🏻‍♂️":":man-lifting-weights::skin-tone-1:","🏋🏼‍♂️":":man-lifting-weights::skin-tone-2:","🏋🏽‍♂️":":man-lifting-weights::skin-tone-3:","🏋🏾‍♂️":":man-lifting-weights::skin-tone-4:","🏋🏿‍♂️":":man-lifting-weights::skin-tone-5:","🏋️‍♂️":":man-lifting-weights:","🏌🏻‍♀️":":woman-golfing::skin-tone-1:","🏌🏼‍♀️":":woman-golfing::skin-tone-2:","🏌🏽‍♀️":":woman-golfing::skin-tone-3:","🏌🏾‍♀️":":woman-golfing::skin-tone-4:","🏌🏿‍♀️":":woman-golfing::skin-tone-5:","🏌️‍♀️":":woman-golfing:","🏌🏻‍♂️":":man-golfing::skin-tone-1:","🏌🏼‍♂️":":man-golfing::skin-tone-2:","🏌🏽‍♂️":":man-golfing::skin-tone-3:","🏌🏾‍♂️":":man-golfing::skin-tone-4:","🏌🏿‍♂️":":man-golfing::skin-tone-5:","🏌️‍♂️":":man-golfing:","🏳️‍🌈":":rainbow-flag:","👁️‍🗨️":":eye-in-speech-bubble:","👨‍👦‍👦":":man-boy-boy:","👨‍👧‍👦":":man-girl-boy:","👨‍👧‍👧":":man-girl-girl:","👨‍👨‍👦":":man-man-boy:","👨‍👨‍👦‍👦":":man-man-boy-boy:","👨‍👨‍👧":":man-man-girl:","👨‍👨‍👧‍👦":":man-man-girl-boy:","👨‍👨‍👧‍👧":":man-man-girl-girl:","👨‍👩‍👦":":man-woman-boy:","👨‍👩‍👦‍👦":":man-woman-boy-boy:","👨‍👩‍👧":":man-woman-girl:","👨‍👩‍👧‍👦":":man-woman-girl-boy:","👨‍👩‍👧‍👧":":man-woman-girl-girl:","👨🏻‍⚕️":":male-doctor::skin-tone-1:","👨🏼‍⚕️":":male-doctor::skin-tone-2:","👨🏽‍⚕️":":male-doctor::skin-tone-3:","👨🏾‍⚕️":":male-doctor::skin-tone-4:","👨🏿‍⚕️":":male-doctor::skin-tone-5:","👨‍⚕️":":male-doctor:","👨🏻‍⚖️":":male-judge::skin-tone-1:","👨🏼‍⚖️":":male-judge::skin-tone-2:","👨🏽‍⚖️":":male-judge::skin-tone-3:","👨🏾‍⚖️":":male-judge::skin-tone-4:","👨🏿‍⚖️":":male-judge::skin-tone-5:","👨‍⚖️":":male-judge:","👨🏻‍✈️":":male-pilot::skin-tone-1:","👨🏼‍✈️":":male-pilot::skin-tone-2:","👨🏽‍✈️":":male-pilot::skin-tone-3:","👨🏾‍✈️":":male-pilot::skin-tone-4:","👨🏿‍✈️":":male-pilot::skin-tone-5:","👨‍✈️":":male-pilot:","👨‍❤️‍👨":":man-heart-man:","👨‍❤️‍💋‍👨":":man-kiss-man:","👩‍👦‍👦":":woman-boy-boy:","👩‍👧‍👦":":woman-girl-boy:","👩‍👧‍👧":":woman-girl-girl:","👩‍👩‍👦":":woman-woman-boy:","👩‍👩‍👦‍👦":":woman-woman-boy-boy:","👩‍👩‍👧":":woman-woman-girl:","👩‍👩‍👧‍👦":":woman-woman-girl-boy:","👩‍👩‍👧‍👧":":woman-woman-girl-girl:","👩🏻‍⚕️":":female-doctor::skin-tone-1:","👩🏼‍⚕️":":female-doctor::skin-tone-2:","👩🏽‍⚕️":":female-doctor::skin-tone-3:","👩🏾‍⚕️":":female-doctor::skin-tone-4:","👩🏿‍⚕️":":female-doctor::skin-tone-5:","👩‍⚕️":":female-doctor:","👩🏻‍⚖️":":female-judge::skin-tone-1:","👩🏼‍⚖️":":female-judge::skin-tone-2:","👩🏽‍⚖️":":female-judge::skin-tone-3:","👩🏾‍⚖️":":female-judge::skin-tone-4:","👩🏿‍⚖️":":female-judge::skin-tone-5:","👩‍⚖️":":female-judge:","👩🏻‍✈️":":female-pilot::skin-tone-1:","👩🏼‍✈️":":female-pilot::skin-tone-2:","👩🏽‍✈️":":female-pilot::skin-tone-3:","👩🏾‍✈️":":female-pilot::skin-tone-4:","👩🏿‍✈️":":female-pilot::skin-tone-5:","👩‍✈️":":female-pilot:","👩‍❤️‍👨":":woman-heart-man:","👩‍❤️‍👩":":woman-heart-woman:","👩‍❤️‍💋‍👨":":woman-kiss-man:","👩‍❤️‍💋‍👩":":woman-kiss-woman:","👮🏻‍♀️":":female-police-officer::skin-tone-1:","👮🏼‍♀️":":female-police-officer::skin-tone-2:","👮🏽‍♀️":":female-police-officer::skin-tone-3:","👮🏾‍♀️":":female-police-officer::skin-tone-4:","👮🏿‍♀️":":female-police-officer::skin-tone-5:","👮‍♀️":":female-police-officer:","👮🏻‍♂️":":male-police-officer::skin-tone-1:","👮🏼‍♂️":":male-police-officer::skin-tone-2:","👮🏽‍♂️":":male-police-officer::skin-tone-3:","👮🏾‍♂️":":male-police-officer::skin-tone-4:","👮🏿‍♂️":":male-police-officer::skin-tone-5:","👮‍♂️":":male-police-officer:","👯‍♀️":":woman-with-bunny-ears-partying:","👯‍♂️":":man-with-bunny-ears-partying:","👱🏻‍♀️":":blond-haired-woman::skin-tone-1:","👱🏼‍♀️":":blond-haired-woman::skin-tone-2:","👱🏽‍♀️":":blond-haired-woman::skin-tone-3:","👱🏾‍♀️":":blond-haired-woman::skin-tone-4:","👱🏿‍♀️":":blond-haired-woman::skin-tone-5:","👱‍♀️":":blond-haired-woman:","👱🏻‍♂️":":blond-haired-man::skin-tone-1:","👱🏼‍♂️":":blond-haired-man::skin-tone-2:","👱🏽‍♂️":":blond-haired-man::skin-tone-3:","👱🏾‍♂️":":blond-haired-man::skin-tone-4:","👱🏿‍♂️":":blond-haired-man::skin-tone-5:","👱‍♂️":":blond-haired-man:","👳🏻‍♀️":":woman-wearing-turban::skin-tone-1:","👳🏼‍♀️":":woman-wearing-turban::skin-tone-2:","👳🏽‍♀️":":woman-wearing-turban::skin-tone-3:","👳🏾‍♀️":":woman-wearing-turban::skin-tone-4:","👳🏿‍♀️":":woman-wearing-turban::skin-tone-5:","👳‍♀️":":woman-wearing-turban:","👳🏻‍♂️":":man-wearing-turban::skin-tone-1:","👳🏼‍♂️":":man-wearing-turban::skin-tone-2:","👳🏽‍♂️":":man-wearing-turban::skin-tone-3:","👳🏾‍♂️":":man-wearing-turban::skin-tone-4:","👳🏿‍♂️":":man-wearing-turban::skin-tone-5:","👳‍♂️":":man-wearing-turban:","👷🏻‍♀️":":female-construction-worker::skin-tone-1:","👷🏼‍♀️":":female-construction-worker::skin-tone-2:","👷🏽‍♀️":":female-construction-worker::skin-tone-3:","👷🏾‍♀️":":female-construction-worker::skin-tone-4:","👷🏿‍♀️":":female-construction-worker::skin-tone-5:","👷‍♀️":":female-construction-worker:","👷🏻‍♂️":":male-construction-worker::skin-tone-1:","👷🏼‍♂️":":male-construction-worker::skin-tone-2:","👷🏽‍♂️":":male-construction-worker::skin-tone-3:","👷🏾‍♂️":":male-construction-worker::skin-tone-4:","👷🏿‍♂️":":male-construction-worker::skin-tone-5:","👷‍♂️":":male-construction-worker:","💁🏻‍♀️":":woman-tipping-hand::skin-tone-1:","💁🏼‍♀️":":woman-tipping-hand::skin-tone-2:","💁🏽‍♀️":":woman-tipping-hand::skin-tone-3:","💁🏾‍♀️":":woman-tipping-hand::skin-tone-4:","💁🏿‍♀️":":woman-tipping-hand::skin-tone-5:","💁‍♀️":":woman-tipping-hand:","💁🏻‍♂️":":man-tipping-hand::skin-tone-1:","💁🏼‍♂️":":man-tipping-hand::skin-tone-2:","💁🏽‍♂️":":man-tipping-hand::skin-tone-3:","💁🏾‍♂️":":man-tipping-hand::skin-tone-4:","💁🏿‍♂️":":man-tipping-hand::skin-tone-5:","💁‍♂️":":man-tipping-hand:","💂🏻‍♀️":":female-guard::skin-tone-1:","💂🏼‍♀️":":female-guard::skin-tone-2:","💂🏽‍♀️":":female-guard::skin-tone-3:","💂🏾‍♀️":":female-guard::skin-tone-4:","💂🏿‍♀️":":female-guard::skin-tone-5:","💂‍♀️":":female-guard:","💂🏻‍♂️":":male-guard::skin-tone-1:","💂🏼‍♂️":":male-guard::skin-tone-2:","💂🏽‍♂️":":male-guard::skin-tone-3:","💂🏾‍♂️":":male-guard::skin-tone-4:","💂🏿‍♂️":":male-guard::skin-tone-5:","💂‍♂️":":male-guard:","💆🏻‍♀️":":woman-getting-massage::skin-tone-1:","💆🏼‍♀️":":woman-getting-massage::skin-tone-2:","💆🏽‍♀️":":woman-getting-massage::skin-tone-3:","💆🏾‍♀️":":woman-getting-massage::skin-tone-4:","💆🏿‍♀️":":woman-getting-massage::skin-tone-5:","💆‍♀️":":woman-getting-massage:","💆🏻‍♂️":":man-getting-massage::skin-tone-1:","💆🏼‍♂️":":man-getting-massage::skin-tone-2:","💆🏽‍♂️":":man-getting-massage::skin-tone-3:","💆🏾‍♂️":":man-getting-massage::skin-tone-4:","💆🏿‍♂️":":man-getting-massage::skin-tone-5:","💆‍♂️":":man-getting-massage:","💇🏻‍♀️":":woman-getting-haircut::skin-tone-1:","💇🏼‍♀️":":woman-getting-haircut::skin-tone-2:","💇🏽‍♀️":":woman-getting-haircut::skin-tone-3:","💇🏾‍♀️":":woman-getting-haircut::skin-tone-4:","💇🏿‍♀️":":woman-getting-haircut::skin-tone-5:","💇‍♀️":":woman-getting-haircut:","💇🏻‍♂️":":man-getting-haircut::skin-tone-1:","💇🏼‍♂️":":man-getting-haircut::skin-tone-2:","💇🏽‍♂️":":man-getting-haircut::skin-tone-3:","💇🏾‍♂️":":man-getting-haircut::skin-tone-4:","💇🏿‍♂️":":man-getting-haircut::skin-tone-5:","💇‍♂️":":man-getting-haircut:","🕵🏻‍♀️":":female-detective::skin-tone-1:","🕵🏼‍♀️":":female-detective::skin-tone-2:","🕵🏽‍♀️":":female-detective::skin-tone-3:","🕵🏾‍♀️":":female-detective::skin-tone-4:","🕵🏿‍♀️":":female-detective::skin-tone-5:","🕵️‍♀️":":female-detective:","🕵🏻‍♂️":":male-detective::skin-tone-1:","🕵🏼‍♂️":":male-detective::skin-tone-2:","🕵🏽‍♂️":":male-detective::skin-tone-3:","🕵🏾‍♂️":":male-detective::skin-tone-4:","🕵🏿‍♂️":":male-detective::skin-tone-5:","🕵️‍♂️":":male-detective:","🙅🏻‍♀️":":woman-gesturing-no::skin-tone-1:","🙅🏼‍♀️":":woman-gesturing-no::skin-tone-2:","🙅🏽‍♀️":":woman-gesturing-no::skin-tone-3:","🙅🏾‍♀️":":woman-gesturing-no::skin-tone-4:","🙅🏿‍♀️":":woman-gesturing-no::skin-tone-5:","🙅‍♀️":":woman-gesturing-no:","🙅🏻‍♂️":":man-gesturing-no::skin-tone-1:","🙅🏼‍♂️":":man-gesturing-no::skin-tone-2:","🙅🏽‍♂️":":man-gesturing-no::skin-tone-3:","🙅🏾‍♂️":":man-gesturing-no::skin-tone-4:","🙅🏿‍♂️":":man-gesturing-no::skin-tone-5:","🙅‍♂️":":man-gesturing-no:","🙆🏻‍♀️":":woman-gesturing-ok::skin-tone-1:","🙆🏼‍♀️":":woman-gesturing-ok::skin-tone-2:","🙆🏽‍♀️":":woman-gesturing-ok::skin-tone-3:","🙆🏾‍♀️":":woman-gesturing-ok::skin-tone-4:","🙆🏿‍♀️":":woman-gesturing-ok::skin-tone-5:","🙆‍♀️":":woman-gesturing-ok:","🙆🏻‍♂️":":man-gesturing-ok::skin-tone-1:","🙆🏼‍♂️":":man-gesturing-ok::skin-tone-2:","🙆🏽‍♂️":":man-gesturing-ok::skin-tone-3:","🙆🏾‍♂️":":man-gesturing-ok::skin-tone-4:","🙆🏿‍♂️":":man-gesturing-ok::skin-tone-5:","🙆‍♂️":":man-gesturing-ok:","🙇🏻‍♀️":":woman-bowing::skin-tone-1:","🙇🏼‍♀️":":woman-bowing::skin-tone-2:","🙇🏽‍♀️":":woman-bowing::skin-tone-3:","🙇🏾‍♀️":":woman-bowing::skin-tone-4:","🙇🏿‍♀️":":woman-bowing::skin-tone-5:","🙇‍♀️":":woman-bowing:","🙇🏻‍♂️":":man-bowing::skin-tone-1:","🙇🏼‍♂️":":man-bowing::skin-tone-2:","🙇🏽‍♂️":":man-bowing::skin-tone-3:","🙇🏾‍♂️":":man-bowing::skin-tone-4:","🙇🏿‍♂️":":man-bowing::skin-tone-5:","🙇‍♂️":":man-bowing:","🙋🏻‍♀️":":woman-raising-hand::skin-tone-1:","🙋🏼‍♀️":":woman-raising-hand::skin-tone-2:","🙋🏽‍♀️":":woman-raising-hand::skin-tone-3:","🙋🏾‍♀️":":woman-raising-hand::skin-tone-4:","🙋🏿‍♀️":":woman-raising-hand::skin-tone-5:","🙋‍♀️":":woman-raising-hand:","🙋🏻‍♂️":":man-raising-hand::skin-tone-1:","🙋🏼‍♂️":":man-raising-hand::skin-tone-2:","🙋🏽‍♂️":":man-raising-hand::skin-tone-3:","🙋🏾‍♂️":":man-raising-hand::skin-tone-4:","🙋🏿‍♂️":":man-raising-hand::skin-tone-5:","🙋‍♂️":":man-raising-hand:","🙍🏻‍♀️":":woman-frowning::skin-tone-1:","🙍🏼‍♀️":":woman-frowning::skin-tone-2:","🙍🏽‍♀️":":woman-frowning::skin-tone-3:","🙍🏾‍♀️":":woman-frowning::skin-tone-4:","🙍🏿‍♀️":":woman-frowning::skin-tone-5:","🙍‍♀️":":woman-frowning:","🙍🏻‍♂️":":man-frowning::skin-tone-1:","🙍🏼‍♂️":":man-frowning::skin-tone-2:","🙍🏽‍♂️":":man-frowning::skin-tone-3:","🙍🏾‍♂️":":man-frowning::skin-tone-4:","🙍🏿‍♂️":":man-frowning::skin-tone-5:","🙍‍♂️":":man-frowning:","🙎🏻‍♀️":":woman-pouting::skin-tone-1:","🙎🏼‍♀️":":woman-pouting::skin-tone-2:","🙎🏽‍♀️":":woman-pouting::skin-tone-3:","🙎🏾‍♀️":":woman-pouting::skin-tone-4:","🙎🏿‍♀️":":woman-pouting::skin-tone-5:","🙎‍♀️":":woman-pouting:","🙎🏻‍♂️":":man-pouting::skin-tone-1:","🙎🏼‍♂️":":man-pouting::skin-tone-2:","🙎🏽‍♂️":":man-pouting::skin-tone-3:","🙎🏾‍♂️":":man-pouting::skin-tone-4:","🙎🏿‍♂️":":man-pouting::skin-tone-5:","🙎‍♂️":":man-pouting:","🚣🏻‍♀️":":woman-rowing-boat::skin-tone-1:","🚣🏼‍♀️":":woman-rowing-boat::skin-tone-2:","🚣🏽‍♀️":":woman-rowing-boat::skin-tone-3:","🚣🏾‍♀️":":woman-rowing-boat::skin-tone-4:","🚣🏿‍♀️":":woman-rowing-boat::skin-tone-5:","🚣‍♀️":":woman-rowing-boat:","🚣🏻‍♂️":":man-rowing-boat::skin-tone-1:","🚣🏼‍♂️":":man-rowing-boat::skin-tone-2:","🚣🏽‍♂️":":man-rowing-boat::skin-tone-3:","🚣🏾‍♂️":":man-rowing-boat::skin-tone-4:","🚣🏿‍♂️":":man-rowing-boat::skin-tone-5:","🚣‍♂️":":man-rowing-boat:","🚴🏻‍♀️":":woman-biking::skin-tone-1:","🚴🏼‍♀️":":woman-biking::skin-tone-2:","🚴🏽‍♀️":":woman-biking::skin-tone-3:","🚴🏾‍♀️":":woman-biking::skin-tone-4:","🚴🏿‍♀️":":woman-biking::skin-tone-5:","🚴‍♀️":":woman-biking:","🚴🏻‍♂️":":man-biking::skin-tone-1:","🚴🏼‍♂️":":man-biking::skin-tone-2:","🚴🏽‍♂️":":man-biking::skin-tone-3:","🚴🏾‍♂️":":man-biking::skin-tone-4:","🚴🏿‍♂️":":man-biking::skin-tone-5:","🚴‍♂️":":man-biking:","🚵🏻‍♀️":":woman-mountain-biking::skin-tone-1:","🚵🏼‍♀️":":woman-mountain-biking::skin-tone-2:","🚵🏽‍♀️":":woman-mountain-biking::skin-tone-3:","🚵🏾‍♀️":":woman-mountain-biking::skin-tone-4:","🚵🏿‍♀️":":woman-mountain-biking::skin-tone-5:","🚵‍♀️":":woman-mountain-biking:","🚵🏻‍♂️":":man-mountain-biking::skin-tone-1:","🚵🏼‍♂️":":man-mountain-biking::skin-tone-2:","🚵🏽‍♂️":":man-mountain-biking::skin-tone-3:","🚵🏾‍♂️":":man-mountain-biking::skin-tone-4:","🚵🏿‍♂️":":man-mountain-biking::skin-tone-5:","🚵‍♂️":":man-mountain-biking:","🚶🏻‍♀️":":woman-walking::skin-tone-1:","🚶🏼‍♀️":":woman-walking::skin-tone-2:","🚶🏽‍♀️":":woman-walking::skin-tone-3:","🚶🏾‍♀️":":woman-walking::skin-tone-4:","🚶🏿‍♀️":":woman-walking::skin-tone-5:","🚶‍♀️":":woman-walking:","🚶🏻‍♂️":":man-walking::skin-tone-1:","🚶🏼‍♂️":":man-walking::skin-tone-2:","🚶🏽‍♂️":":man-walking::skin-tone-3:","🚶🏾‍♂️":":man-walking::skin-tone-4:","🚶🏿‍♂️":":man-walking::skin-tone-5:","🚶‍♂️":":man-walking:","🤦🏻‍♀️":":woman-facepalming::skin-tone-1:","🤦🏼‍♀️":":woman-facepalming::skin-tone-2:","🤦🏽‍♀️":":woman-facepalming::skin-tone-3:","🤦🏾‍♀️":":woman-facepalming::skin-tone-4:","🤦🏿‍♀️":":woman-facepalming::skin-tone-5:","🤦‍♀️":":woman-facepalming:","🤦🏻‍♂️":":man-facepalming::skin-tone-1:","🤦🏼‍♂️":":man-facepalming::skin-tone-2:","🤦🏽‍♂️":":man-facepalming::skin-tone-3:","🤦🏾‍♂️":":man-facepalming::skin-tone-4:","🤦🏿‍♂️":":man-facepalming::skin-tone-5:","🤦‍♂️":":man-facepalming:","🤷🏻‍♀️":":woman-shrugging::skin-tone-1:","🤷🏼‍♀️":":woman-shrugging::skin-tone-2:","🤷🏽‍♀️":":woman-shrugging::skin-tone-3:","🤷🏾‍♀️":":woman-shrugging::skin-tone-4:","🤷🏿‍♀️":":woman-shrugging::skin-tone-5:","🤷‍♀️":":woman-shrugging:","🤷🏻‍♂️":":man-shrugging::skin-tone-1:","🤷🏼‍♂️":":man-shrugging::skin-tone-2:","🤷🏽‍♂️":":man-shrugging::skin-tone-3:","🤷🏾‍♂️":":man-shrugging::skin-tone-4:","🤷🏿‍♂️":":man-shrugging::skin-tone-5:","🤷‍♂️":":man-shrugging:","🤸🏻‍♀️":":woman-cartwheeling::skin-tone-1:","🤸🏼‍♀️":":woman-cartwheeling::skin-tone-2:","🤸🏽‍♀️":":woman-cartwheeling::skin-tone-3:","🤸🏾‍♀️":":woman-cartwheeling::skin-tone-4:","🤸🏿‍♀️":":woman-cartwheeling::skin-tone-5:","🤸‍♀️":":woman-cartwheeling:","🤸🏻‍♂️":":man-cartwheeling::skin-tone-1:","🤸🏼‍♂️":":man-cartwheeling::skin-tone-2:","🤸🏽‍♂️":":man-cartwheeling::skin-tone-3:","🤸🏾‍♂️":":man-cartwheeling::skin-tone-4:","🤸🏿‍♂️":":man-cartwheeling::skin-tone-5:","🤸‍♂️":":man-cartwheeling:","🤹🏻‍♀️":":woman-juggling::skin-tone-1:","🤹🏼‍♀️":":woman-juggling::skin-tone-2:","🤹🏽‍♀️":":woman-juggling::skin-tone-3:","🤹🏾‍♀️":":woman-juggling::skin-tone-4:","🤹🏿‍♀️":":woman-juggling::skin-tone-5:","🤹‍♀️":":woman-juggling:","🤹🏻‍♂️":":man-juggling::skin-tone-1:","🤹🏼‍♂️":":man-juggling::skin-tone-2:","🤹🏽‍♂️":":man-juggling::skin-tone-3:","🤹🏾‍♂️":":man-juggling::skin-tone-4:","🤹🏿‍♂️":":man-juggling::skin-tone-5:","🤹‍♂️":":man-juggling:","🤼‍♀️":":woman-wrestling:","🤼‍♂️":":man-wrestling:","🤽🏻‍♀️":":woman-playing-water-polo::skin-tone-1:","🤽🏼‍♀️":":woman-playing-water-polo::skin-tone-2:","🤽🏽‍♀️":":woman-playing-water-polo::skin-tone-3:","🤽🏾‍♀️":":woman-playing-water-polo::skin-tone-4:","🤽🏿‍♀️":":woman-playing-water-polo::skin-tone-5:","🤽‍♀️":":woman-playing-water-polo:","🤽🏻‍♂️":":man-playing-water-polo::skin-tone-1:","🤽🏼‍♂️":":man-playing-water-polo::skin-tone-2:","🤽🏽‍♂️":":man-playing-water-polo::skin-tone-3:","🤽🏾‍♂️":":man-playing-water-polo::skin-tone-4:","🤽🏿‍♂️":":man-playing-water-polo::skin-tone-5:","🤽‍♂️":":man-playing-water-polo:","🤾🏻‍♀️":":woman-playing-handball::skin-tone-1:","🤾🏼‍♀️":":woman-playing-handball::skin-tone-2:","🤾🏽‍♀️":":woman-playing-handball::skin-tone-3:","🤾🏾‍♀️":":woman-playing-handball::skin-tone-4:","🤾🏿‍♀️":":woman-playing-handball::skin-tone-5:","🤾‍♀️":":woman-playing-handball:","🤾🏻‍♂️":":man-playing-handball::skin-tone-1:","🤾🏼‍♂️":":man-playing-handball::skin-tone-2:","🤾🏽‍♂️":":man-playing-handball::skin-tone-3:","🤾🏾‍♂️":":man-playing-handball::skin-tone-4:","🤾🏿‍♂️":":man-playing-handball::skin-tone-5:","🤾‍♂️":":man-playing-handball:","⛹🏻‍♀️":":woman-bouncing-ball::skin-tone-1:","⛹🏼‍♀️":":woman-bouncing-ball::skin-tone-2:","⛹🏽‍♀️":":woman-bouncing-ball::skin-tone-3:","⛹🏾‍♀️":":woman-bouncing-ball::skin-tone-4:","⛹🏿‍♀️":":woman-bouncing-ball::skin-tone-5:","⛹️‍♀️":":woman-bouncing-ball:","⛹🏻‍♂️":":man-bouncing-ball::skin-tone-1:","⛹🏼‍♂️":":man-bouncing-ball::skin-tone-2:","⛹🏽‍♂️":":man-bouncing-ball::skin-tone-3:","⛹🏾‍♂️":":man-bouncing-ball::skin-tone-4:","⛹🏿‍♂️":":man-bouncing-ball::skin-tone-5:","⛹️‍♂️":":man-bouncing-ball:"}
    const emojiIndexByName = {":copyright:":"©",":registered:":"®",":bangbang:":"‼",":interrobang:":"⁉",":tm:":"™",":information_source:":"ℹ",":left_right_arrow:":"↔",":arrow_up_down:":"↕",":arrow_upper_left:":"↖",":arrow_upper_right:":"↗",":arrow_lower_right:":"↘",":arrow_lower_left:":"↙",":leftwards_arrow_with_hook:":"↩",":arrow_right_hook:":"↪",":watch:":"⌚",":hourglass:":"⌛",":keyboard:":"⌨",":eject:":"⏏",":fast_forward:":"⏩",":rewind:":"⏪",":arrow_double_up:":"⏫",":arrow_double_down:":"⏬",":black_right_pointing_double_triangle_with_vertical_bar:":"⏭",":black_left_pointing_double_triangle_with_vertical_bar:":"⏮",":black_right_pointing_triangle_with_double_vertical_bar:":"⏯",":alarm_clock:":"⏰",":stopwatch:":"⏱",":timer_clock:":"⏲",":hourglass_flowing_sand:":"⏳",":double_vertical_bar:":"⏸",":black_square_for_stop:":"⏹",":black_circle_for_record:":"⏺",":m:":"Ⓜ",":black_small_square:":"▪",":white_small_square:":"▫",":arrow_forward:":"▶",":arrow_backward:":"◀",":white_medium_square:":"◻",":black_medium_square:":"◼",":white_medium_small_square:":"◽",":black_medium_small_square:":"◾",":sunny:":"☀",":cloud:":"☁",":umbrella:":"☂",":snowman:":"☃",":comet:":"☄",":phone:":"☎",":ballot_box_with_check:":"☑",":umbrella_with_rain_drops:":"☔",":coffee:":"☕",":shamrock:":"☘",":point_up::skin-tone-1:":"☝🏻",":point_up::skin-tone-2:":"☝🏼",":point_up::skin-tone-3:":"☝🏽",":point_up::skin-tone-4:":"☝🏾",":point_up::skin-tone-5:":"☝🏿",":point_up:":"☝",":skull_and_crossbones:":"☠",":radioactive_sign:":"☢",":biohazard_sign:":"☣",":orthodox_cross:":"☦",":star_and_crescent:":"☪",":peace_symbol:":"☮",":yin_yang:":"☯",":wheel_of_dharma:":"☸",":white_frowning_face:":"☹",":relaxed:":"☺",":female_sign:":"♀",":male_sign:":"♂",":aries:":"♈",":taurus:":"♉",":gemini:":"♊",":cancer:":"♋",":leo:":"♌",":virgo:":"♍",":libra:":"♎",":scorpius:":"♏",":sagittarius:":"♐",":capricorn:":"♑",":aquarius:":"♒",":pisces:":"♓",":spades:":"♠",":clubs:":"♣",":hearts:":"♥",":diamonds:":"♦",":hotsprings:":"♨",":recycle:":"♻",":wheelchair:":"♿",":hammer_and_pick:":"⚒",":anchor:":"⚓",":crossed_swords:":"⚔",":staff_of_aesculapius:":"⚕",":scales:":"⚖",":alembic:":"⚗",":gear:":"⚙",":atom_symbol:":"⚛",":fleur_de_lis:":"⚜",":warning:":"⚠",":zap:":"⚡",":white_circle:":"⚪",":black_circle:":"⚫",":coffin:":"⚰",":funeral_urn:":"⚱",":soccer:":"⚽",":baseball:":"⚾",":snowman_without_snow:":"⛄",":partly_sunny:":"⛅",":thunder_cloud_and_rain:":"⛈",":ophiuchus:":"⛎",":pick:":"⛏",":helmet_with_white_cross:":"⛑",":chains:":"⛓",":no_entry:":"⛔",":shinto_shrine:":"⛩",":church:":"⛪",":mountain:":"⛰",":umbrella_on_ground:":"⛱",":fountain:":"⛲",":golf:":"⛳",":ferry:":"⛴",":boat:":"⛵",":skier:":"⛷",":ice_skate:":"⛸",":person_with_ball::skin-tone-1:":"⛹🏻",":person_with_ball::skin-tone-2:":"⛹🏼",":person_with_ball::skin-tone-3:":"⛹🏽",":person_with_ball::skin-tone-4:":"⛹🏾",":person_with_ball::skin-tone-5:":"⛹🏿",":person_with_ball:":"⛹",":tent:":"⛺",":fuelpump:":"⛽",":scissors:":"✂",":white_check_mark:":"✅",":airplane:":"✈",":email:":"✉",":fist::skin-tone-1:":"✊🏻",":fist::skin-tone-2:":"✊🏼",":fist::skin-tone-3:":"✊🏽",":fist::skin-tone-4:":"✊🏾",":fist::skin-tone-5:":"✊🏿",":fist:":"✊",":hand::skin-tone-1:":"✋🏻",":hand::skin-tone-2:":"✋🏼",":hand::skin-tone-3:":"✋🏽",":hand::skin-tone-4:":"✋🏾",":hand::skin-tone-5:":"✋🏿",":hand:":"✋",":v::skin-tone-1:":"✌🏻",":v::skin-tone-2:":"✌🏼",":v::skin-tone-3:":"✌🏽",":v::skin-tone-4:":"✌🏾",":v::skin-tone-5:":"✌🏿",":v:":"✌",":writing_hand::skin-tone-1:":"✍🏻",":writing_hand::skin-tone-2:":"✍🏼",":writing_hand::skin-tone-3:":"✍🏽",":writing_hand::skin-tone-4:":"✍🏾",":writing_hand::skin-tone-5:":"✍🏿",":writing_hand:":"✍",":pencil2:":"✏",":black_nib:":"✒",":heavy_check_mark:":"✔",":heavy_multiplication_x:":"✖",":latin_cross:":"✝",":star_of_david:":"✡",":sparkles:":"✨",":eight_spoked_asterisk:":"✳",":eight_pointed_black_star:":"✴",":snowflake:":"❄",":sparkle:":"❇",":x:":"❌",":negative_squared_cross_mark:":"❎",":question:":"❓",":grey_question:":"❔",":grey_exclamation:":"❕",":exclamation:":"❗",":heavy_heart_exclamation_mark_ornament:":"❣",":heart:":"❤",":heavy_plus_sign:":"➕",":heavy_minus_sign:":"➖",":heavy_division_sign:":"➗",":arrow_right:":"➡",":curly_loop:":"➰",":loop:":"➿",":arrow_heading_up:":"⤴",":arrow_heading_down:":"⤵",":arrow_left:":"⬅",":arrow_up:":"⬆",":arrow_down:":"⬇",":black_large_square:":"⬛",":white_large_square:":"⬜",":star:":"⭐",":o:":"⭕",":wavy_dash:":"〰",":part_alternation_mark:":"〽",":congratulations:":"㊗",":secret:":"㊙",":mahjong:":"🀄",":black_joker:":"🃏",":a:":"🅰",":b:":"🅱",":o2:":"🅾",":parking:":"🅿",":ab:":"🆎",":cl:":"🆑",":cool:":"🆒",":free:":"🆓",":id:":"🆔",":new:":"🆕",":ng:":"🆖",":ok:":"🆗",":sos:":"🆘",":up:":"🆙",":vs:":"🆚",":koko:":"🈁",":sa:":"🈂",":u7121:":"🈚",":u6307:":"🈯",":u7981:":"🈲",":u7a7a:":"🈳",":u5408:":"🈴",":u6e80:":"🈵",":u6709:":"🈶",":u6708:":"🈷",":u7533:":"🈸",":u5272:":"🈹",":u55b6:":"🈺",":ideograph_advantage:":"🉐",":accept:":"🉑",":cyclone:":"🌀",":foggy:":"🌁",":closed_umbrella:":"🌂",":night_with_stars:":"🌃",":sunrise_over_mountains:":"🌄",":sunrise:":"🌅",":city_sunset:":"🌆",":city_sunrise:":"🌇",":rainbow:":"🌈",":bridge_at_night:":"🌉",":ocean:":"🌊",":volcano:":"🌋",":milky_way:":"🌌",":earth_africa:":"🌍",":earth_americas:":"🌎",":earth_asia:":"🌏",":globe_with_meridians:":"🌐",":new_moon:":"🌑",":waxing_crescent_moon:":"🌒",":first_quarter_moon:":"🌓",":moon:":"🌔",":full_moon:":"🌕",":waning_gibbous_moon:":"🌖",":last_quarter_moon:":"🌗",":waning_crescent_moon:":"🌘",":crescent_moon:":"🌙",":new_moon_with_face:":"🌚",":first_quarter_moon_with_face:":"🌛",":last_quarter_moon_with_face:":"🌜",":full_moon_with_face:":"🌝",":sun_with_face:":"🌞",":star2:":"🌟",":stars:":"🌠",":thermometer:":"🌡",":mostly_sunny:":"🌤",":barely_sunny:":"🌥",":partly_sunny_rain:":"🌦",":rain_cloud:":"🌧",":snow_cloud:":"🌨",":lightning:":"🌩",":tornado:":"🌪",":fog:":"🌫",":wind_blowing_face:":"🌬",":hotdog:":"🌭",":taco:":"🌮",":burrito:":"🌯",":chestnut:":"🌰",":seedling:":"🌱",":evergreen_tree:":"🌲",":deciduous_tree:":"🌳",":palm_tree:":"🌴",":cactus:":"🌵",":hot_pepper:":"🌶",":tulip:":"🌷",":cherry_blossom:":"🌸",":rose:":"🌹",":hibiscus:":"🌺",":sunflower:":"🌻",":blossom:":"🌼",":corn:":"🌽",":ear_of_rice:":"🌾",":herb:":"🌿",":four_leaf_clover:":"🍀",":maple_leaf:":"🍁",":fallen_leaf:":"🍂",":leaves:":"🍃",":mushroom:":"🍄",":tomato:":"🍅",":eggplant:":"🍆",":grapes:":"🍇",":melon:":"🍈",":watermelon:":"🍉",":tangerine:":"🍊",":lemon:":"🍋",":banana:":"🍌",":pineapple:":"🍍",":apple:":"🍎",":green_apple:":"🍏",":pear:":"🍐",":peach:":"🍑",":cherries:":"🍒",":strawberry:":"🍓",":hamburger:":"🍔",":pizza:":"🍕",":meat_on_bone:":"🍖",":poultry_leg:":"🍗",":rice_cracker:":"🍘",":rice_ball:":"🍙",":rice:":"🍚",":curry:":"🍛",":ramen:":"🍜",":spaghetti:":"🍝",":bread:":"🍞",":fries:":"🍟",":sweet_potato:":"🍠",":dango:":"🍡",":oden:":"🍢",":sushi:":"🍣",":fried_shrimp:":"🍤",":fish_cake:":"🍥",":icecream:":"🍦",":shaved_ice:":"🍧",":ice_cream:":"🍨",":doughnut:":"🍩",":cookie:":"🍪",":chocolate_bar:":"🍫",":candy:":"🍬",":lollipop:":"🍭",":custard:":"🍮",":honey_pot:":"🍯",":cake:":"🍰",":bento:":"🍱",":stew:":"🍲",":fried_egg:":"🍳",":fork_and_knife:":"🍴",":tea:":"🍵",":sake:":"🍶",":wine_glass:":"🍷",":cocktail:":"🍸",":tropical_drink:":"🍹",":beer:":"🍺",":beers:":"🍻",":baby_bottle:":"🍼",":knife_fork_plate:":"🍽",":champagne:":"🍾",":popcorn:":"🍿",":ribbon:":"🎀",":gift:":"🎁",":birthday:":"🎂",":jack_o_lantern:":"🎃",":christmas_tree:":"🎄",":santa::skin-tone-1:":"🎅🏻",":santa::skin-tone-2:":"🎅🏼",":santa::skin-tone-3:":"🎅🏽",":santa::skin-tone-4:":"🎅🏾",":santa::skin-tone-5:":"🎅🏿",":santa:":"🎅",":fireworks:":"🎆",":sparkler:":"🎇",":balloon:":"🎈",":tada:":"🎉",":confetti_ball:":"🎊",":tanabata_tree:":"🎋",":crossed_flags:":"🎌",":bamboo:":"🎍",":dolls:":"🎎",":flags:":"🎏",":wind_chime:":"🎐",":rice_scene:":"🎑",":school_satchel:":"🎒",":mortar_board:":"🎓",":medal:":"🎖",":reminder_ribbon:":"🎗",":studio_microphone:":"🎙",":level_slider:":"🎚",":control_knobs:":"🎛",":film_frames:":"🎞",":admission_tickets:":"🎟",":carousel_horse:":"🎠",":ferris_wheel:":"🎡",":roller_coaster:":"🎢",":fishing_pole_and_fish:":"🎣",":microphone:":"🎤",":movie_camera:":"🎥",":cinema:":"🎦",":headphones:":"🎧",":art:":"🎨",":tophat:":"🎩",":circus_tent:":"🎪",":ticket:":"🎫",":clapper:":"🎬",":performing_arts:":"🎭",":video_game:":"🎮",":dart:":"🎯",":slot_machine:":"🎰",":8ball:":"🎱",":game_die:":"🎲",":bowling:":"🎳",":flower_playing_cards:":"🎴",":musical_note:":"🎵",":notes:":"🎶",":saxophone:":"🎷",":guitar:":"🎸",":musical_keyboard:":"🎹",":trumpet:":"🎺",":violin:":"🎻",":musical_score:":"🎼",":running_shirt_with_sash:":"🎽",":tennis:":"🎾",":ski:":"🎿",":basketball:":"🏀",":checkered_flag:":"🏁",":snowboarder::skin-tone-1:":"🏂🏻",":snowboarder::skin-tone-2:":"🏂🏼",":snowboarder::skin-tone-3:":"🏂🏽",":snowboarder::skin-tone-4:":"🏂🏾",":snowboarder::skin-tone-5:":"🏂🏿",":snowboarder:":"🏂",":runner::skin-tone-1:":"🏃🏻",":runner::skin-tone-2:":"🏃🏼",":runner::skin-tone-3:":"🏃🏽",":runner::skin-tone-4:":"🏃🏾",":runner::skin-tone-5:":"🏃🏿",":runner:":"🏃",":surfer::skin-tone-1:":"🏄🏻",":surfer::skin-tone-2:":"🏄🏼",":surfer::skin-tone-3:":"🏄🏽",":surfer::skin-tone-4:":"🏄🏾",":surfer::skin-tone-5:":"🏄🏿",":surfer:":"🏄",":sports_medal:":"🏅",":trophy:":"🏆",":horse_racing::skin-tone-1:":"🏇🏻",":horse_racing::skin-tone-2:":"🏇🏼",":horse_racing::skin-tone-3:":"🏇🏽",":horse_racing::skin-tone-4:":"🏇🏾",":horse_racing::skin-tone-5:":"🏇🏿",":horse_racing:":"🏇",":football:":"🏈",":rugby_football:":"🏉",":swimmer::skin-tone-1:":"🏊🏻",":swimmer::skin-tone-2:":"🏊🏼",":swimmer::skin-tone-3:":"🏊🏽",":swimmer::skin-tone-4:":"🏊🏾",":swimmer::skin-tone-5:":"🏊🏿",":swimmer:":"🏊",":weight_lifter::skin-tone-1:":"🏋🏻",":weight_lifter::skin-tone-2:":"🏋🏼",":weight_lifter::skin-tone-3:":"🏋🏽",":weight_lifter::skin-tone-4:":"🏋🏾",":weight_lifter::skin-tone-5:":"🏋🏿",":weight_lifter:":"🏋",":golfer::skin-tone-1:":"🏌🏻",":golfer::skin-tone-2:":"🏌🏼",":golfer::skin-tone-3:":"🏌🏽",":golfer::skin-tone-4:":"🏌🏾",":golfer::skin-tone-5:":"🏌🏿",":golfer:":"🏌",":racing_motorcycle:":"🏍",":racing_car:":"🏎",":cricket_bat_and_ball:":"🏏",":volleyball:":"🏐",":field_hockey_stick_and_ball:":"🏑",":ice_hockey_stick_and_puck:":"🏒",":table_tennis_paddle_and_ball:":"🏓",":snow_capped_mountain:":"🏔",":camping:":"🏕",":beach_with_umbrella:":"🏖",":building_construction:":"🏗",":house_buildings:":"🏘",":cityscape:":"🏙",":derelict_house_building:":"🏚",":classical_building:":"🏛",":desert:":"🏜",":desert_island:":"🏝",":national_park:":"🏞",":stadium:":"🏟",":house:":"🏠",":house_with_garden:":"🏡",":office:":"🏢",":post_office:":"🏣",":european_post_office:":"🏤",":hospital:":"🏥",":bank:":"🏦",":atm:":"🏧",":hotel:":"🏨",":love_hotel:":"🏩",":convenience_store:":"🏪",":school:":"🏫",":department_store:":"🏬",":factory:":"🏭",":izakaya_lantern:":"🏮",":japanese_castle:":"🏯",":european_castle:":"🏰",":waving_white_flag:":"🏳",":waving_black_flag:":"🏴",":rosette:":"🏵",":label:":"🏷",":badminton_racquet_and_shuttlecock:":"🏸",":bow_and_arrow:":"🏹",":amphora:":"🏺",":skin-tone-2:":"🏻",":skin-tone-3:":"🏼",":skin-tone-4:":"🏽",":skin-tone-5:":"🏾",":skin-tone-6:":"🏿",":rat:":"🐀",":mouse2:":"🐁",":ox:":"🐂",":water_buffalo:":"🐃",":cow2:":"🐄",":tiger2:":"🐅",":leopard:":"🐆",":rabbit2:":"🐇",":cat2:":"🐈",":dragon:":"🐉",":crocodile:":"🐊",":whale2:":"🐋",":snail:":"🐌",":snake:":"🐍",":racehorse:":"🐎",":ram:":"🐏",":goat:":"🐐",":sheep:":"🐑",":monkey:":"🐒",":rooster:":"🐓",":chicken:":"🐔",":dog2:":"🐕",":pig2:":"🐖",":boar:":"🐗",":elephant:":"🐘",":octopus:":"🐙",":shell:":"🐚",":bug:":"🐛",":ant:":"🐜",":bee:":"🐝",":beetle:":"🐞",":fish:":"🐟",":tropical_fish:":"🐠",":blowfish:":"🐡",":turtle:":"🐢",":hatching_chick:":"🐣",":baby_chick:":"🐤",":hatched_chick:":"🐥",":bird:":"🐦",":penguin:":"🐧",":koala:":"🐨",":poodle:":"🐩",":dromedary_camel:":"🐪",":camel:":"🐫",":dolphin:":"🐬",":mouse:":"🐭",":cow:":"🐮",":tiger:":"🐯",":rabbit:":"🐰",":cat:":"🐱",":dragon_face:":"🐲",":whale:":"🐳",":horse:":"🐴",":monkey_face:":"🐵",":dog:":"🐶",":pig:":"🐷",":frog:":"🐸",":hamster:":"🐹",":wolf:":"🐺",":bear:":"🐻",":panda_face:":"🐼",":pig_nose:":"🐽",":feet:":"🐾",":chipmunk:":"🐿",":eyes:":"👀",":eye:":"👁",":ear::skin-tone-1:":"👂🏻",":ear::skin-tone-2:":"👂🏼",":ear::skin-tone-3:":"👂🏽",":ear::skin-tone-4:":"👂🏾",":ear::skin-tone-5:":"👂🏿",":ear:":"👂",":nose::skin-tone-1:":"👃🏻",":nose::skin-tone-2:":"👃🏼",":nose::skin-tone-3:":"👃🏽",":nose::skin-tone-4:":"👃🏾",":nose::skin-tone-5:":"👃🏿",":nose:":"👃",":lips:":"👄",":tongue:":"👅",":point_up_2::skin-tone-1:":"👆🏻",":point_up_2::skin-tone-2:":"👆🏼",":point_up_2::skin-tone-3:":"👆🏽",":point_up_2::skin-tone-4:":"👆🏾",":point_up_2::skin-tone-5:":"👆🏿",":point_up_2:":"👆",":point_down::skin-tone-1:":"👇🏻",":point_down::skin-tone-2:":"👇🏼",":point_down::skin-tone-3:":"👇🏽",":point_down::skin-tone-4:":"👇🏾",":point_down::skin-tone-5:":"👇🏿",":point_down:":"👇",":point_left::skin-tone-1:":"👈🏻",":point_left::skin-tone-2:":"👈🏼",":point_left::skin-tone-3:":"👈🏽",":point_left::skin-tone-4:":"👈🏾",":point_left::skin-tone-5:":"👈🏿",":point_left:":"👈",":point_right::skin-tone-1:":"👉🏻",":point_right::skin-tone-2:":"👉🏼",":point_right::skin-tone-3:":"👉🏽",":point_right::skin-tone-4:":"👉🏾",":point_right::skin-tone-5:":"👉🏿",":point_right:":"👉",":facepunch::skin-tone-1:":"👊🏻",":facepunch::skin-tone-2:":"👊🏼",":facepunch::skin-tone-3:":"👊🏽",":facepunch::skin-tone-4:":"👊🏾",":facepunch::skin-tone-5:":"👊🏿",":facepunch:":"👊",":wave::skin-tone-1:":"👋🏻",":wave::skin-tone-2:":"👋🏼",":wave::skin-tone-3:":"👋🏽",":wave::skin-tone-4:":"👋🏾",":wave::skin-tone-5:":"👋🏿",":wave:":"👋",":ok_hand::skin-tone-1:":"👌🏻",":ok_hand::skin-tone-2:":"👌🏼",":ok_hand::skin-tone-3:":"👌🏽",":ok_hand::skin-tone-4:":"👌🏾",":ok_hand::skin-tone-5:":"👌🏿",":ok_hand:":"👌",":+1::skin-tone-1:":"👍🏻",":+1::skin-tone-2:":"👍🏼",":+1::skin-tone-3:":"👍🏽",":+1::skin-tone-4:":"👍🏾",":+1::skin-tone-5:":"👍🏿",":+1:":"👍",":-1::skin-tone-1:":"👎🏻",":-1::skin-tone-2:":"👎🏼",":-1::skin-tone-3:":"👎🏽",":-1::skin-tone-4:":"👎🏾",":-1::skin-tone-5:":"👎🏿",":-1:":"👎",":clap::skin-tone-1:":"👏🏻",":clap::skin-tone-2:":"👏🏼",":clap::skin-tone-3:":"👏🏽",":clap::skin-tone-4:":"👏🏾",":clap::skin-tone-5:":"👏🏿",":clap:":"👏",":open_hands::skin-tone-1:":"👐🏻",":open_hands::skin-tone-2:":"👐🏼",":open_hands::skin-tone-3:":"👐🏽",":open_hands::skin-tone-4:":"👐🏾",":open_hands::skin-tone-5:":"👐🏿",":open_hands:":"👐",":crown:":"👑",":womans_hat:":"👒",":eyeglasses:":"👓",":necktie:":"👔",":shirt:":"👕",":jeans:":"👖",":dress:":"👗",":kimono:":"👘",":bikini:":"👙",":womans_clothes:":"👚",":purse:":"👛",":handbag:":"👜",":pouch:":"👝",":mans_shoe:":"👞",":athletic_shoe:":"👟",":high_heel:":"👠",":sandal:":"👡",":boot:":"👢",":footprints:":"👣",":bust_in_silhouette:":"👤",":busts_in_silhouette:":"👥",":boy::skin-tone-1:":"👦🏻",":boy::skin-tone-2:":"👦🏼",":boy::skin-tone-3:":"👦🏽",":boy::skin-tone-4:":"👦🏾",":boy::skin-tone-5:":"👦🏿",":boy:":"👦",":girl::skin-tone-1:":"👧🏻",":girl::skin-tone-2:":"👧🏼",":girl::skin-tone-3:":"👧🏽",":girl::skin-tone-4:":"👧🏾",":girl::skin-tone-5:":"👧🏿",":girl:":"👧",":man::skin-tone-1:":"👨🏻",":man::skin-tone-2:":"👨🏼",":man::skin-tone-3:":"👨🏽",":man::skin-tone-4:":"👨🏾",":man::skin-tone-5:":"👨🏿",":man:":"👨",":woman::skin-tone-1:":"👩🏻",":woman::skin-tone-2:":"👩🏼",":woman::skin-tone-3:":"👩🏽",":woman::skin-tone-4:":"👩🏾",":woman::skin-tone-5:":"👩🏿",":woman:":"👩",":family:":"👪",":couple:":"👫",":two_men_holding_hands:":"👬",":two_women_holding_hands:":"👭",":cop::skin-tone-1:":"👮🏻",":cop::skin-tone-2:":"👮🏼",":cop::skin-tone-3:":"👮🏽",":cop::skin-tone-4:":"👮🏾",":cop::skin-tone-5:":"👮🏿",":cop:":"👮",":dancers:":"👯",":bride_with_veil::skin-tone-1:":"👰🏻",":bride_with_veil::skin-tone-2:":"👰🏼",":bride_with_veil::skin-tone-3:":"👰🏽",":bride_with_veil::skin-tone-4:":"👰🏾",":bride_with_veil::skin-tone-5:":"👰🏿",":bride_with_veil:":"👰",":person_with_blond_hair::skin-tone-1:":"👱🏻",":person_with_blond_hair::skin-tone-2:":"👱🏼",":person_with_blond_hair::skin-tone-3:":"👱🏽",":person_with_blond_hair::skin-tone-4:":"👱🏾",":person_with_blond_hair::skin-tone-5:":"👱🏿",":person_with_blond_hair:":"👱",":man_with_gua_pi_mao::skin-tone-1:":"👲🏻",":man_with_gua_pi_mao::skin-tone-2:":"👲🏼",":man_with_gua_pi_mao::skin-tone-3:":"👲🏽",":man_with_gua_pi_mao::skin-tone-4:":"👲🏾",":man_with_gua_pi_mao::skin-tone-5:":"👲🏿",":man_with_gua_pi_mao:":"👲",":man_with_turban::skin-tone-1:":"👳🏻",":man_with_turban::skin-tone-2:":"👳🏼",":man_with_turban::skin-tone-3:":"👳🏽",":man_with_turban::skin-tone-4:":"👳🏾",":man_with_turban::skin-tone-5:":"👳🏿",":man_with_turban:":"👳",":older_man::skin-tone-1:":"👴🏻",":older_man::skin-tone-2:":"👴🏼",":older_man::skin-tone-3:":"👴🏽",":older_man::skin-tone-4:":"👴🏾",":older_man::skin-tone-5:":"👴🏿",":older_man:":"👴",":older_woman::skin-tone-1:":"👵🏻",":older_woman::skin-tone-2:":"👵🏼",":older_woman::skin-tone-3:":"👵🏽",":older_woman::skin-tone-4:":"👵🏾",":older_woman::skin-tone-5:":"👵🏿",":older_woman:":"👵",":baby::skin-tone-1:":"👶🏻",":baby::skin-tone-2:":"👶🏼",":baby::skin-tone-3:":"👶🏽",":baby::skin-tone-4:":"👶🏾",":baby::skin-tone-5:":"👶🏿",":baby:":"👶",":construction_worker::skin-tone-1:":"👷🏻",":construction_worker::skin-tone-2:":"👷🏼",":construction_worker::skin-tone-3:":"👷🏽",":construction_worker::skin-tone-4:":"👷🏾",":construction_worker::skin-tone-5:":"👷🏿",":construction_worker:":"👷",":princess::skin-tone-1:":"👸🏻",":princess::skin-tone-2:":"👸🏼",":princess::skin-tone-3:":"👸🏽",":princess::skin-tone-4:":"👸🏾",":princess::skin-tone-5:":"👸🏿",":princess:":"👸",":japanese_ogre:":"👹",":japanese_goblin:":"👺",":ghost:":"👻",":angel::skin-tone-1:":"👼🏻",":angel::skin-tone-2:":"👼🏼",":angel::skin-tone-3:":"👼🏽",":angel::skin-tone-4:":"👼🏾",":angel::skin-tone-5:":"👼🏿",":angel:":"👼",":alien:":"👽",":space_invader:":"👾",":imp:":"👿",":skull:":"💀",":information_desk_person::skin-tone-1:":"💁🏻",":information_desk_person::skin-tone-2:":"💁🏼",":information_desk_person::skin-tone-3:":"💁🏽",":information_desk_person::skin-tone-4:":"💁🏾",":information_desk_person::skin-tone-5:":"💁🏿",":information_desk_person:":"💁",":guardsman::skin-tone-1:":"💂🏻",":guardsman::skin-tone-2:":"💂🏼",":guardsman::skin-tone-3:":"💂🏽",":guardsman::skin-tone-4:":"💂🏾",":guardsman::skin-tone-5:":"💂🏿",":guardsman:":"💂",":dancer::skin-tone-1:":"💃🏻",":dancer::skin-tone-2:":"💃🏼",":dancer::skin-tone-3:":"💃🏽",":dancer::skin-tone-4:":"💃🏾",":dancer::skin-tone-5:":"💃🏿",":dancer:":"💃",":lipstick:":"💄",":nail_care::skin-tone-1:":"💅🏻",":nail_care::skin-tone-2:":"💅🏼",":nail_care::skin-tone-3:":"💅🏽",":nail_care::skin-tone-4:":"💅🏾",":nail_care::skin-tone-5:":"💅🏿",":nail_care:":"💅",":massage::skin-tone-1:":"💆🏻",":massage::skin-tone-2:":"💆🏼",":massage::skin-tone-3:":"💆🏽",":massage::skin-tone-4:":"💆🏾",":massage::skin-tone-5:":"💆🏿",":massage:":"💆",":haircut::skin-tone-1:":"💇🏻",":haircut::skin-tone-2:":"💇🏼",":haircut::skin-tone-3:":"💇🏽",":haircut::skin-tone-4:":"💇🏾",":haircut::skin-tone-5:":"💇🏿",":haircut:":"💇",":barber:":"💈",":syringe:":"💉",":pill:":"💊",":kiss:":"💋",":love_letter:":"💌",":ring:":"💍",":gem:":"💎",":couplekiss:":"💏",":bouquet:":"💐",":couple_with_heart:":"💑",":wedding:":"💒",":heartbeat:":"💓",":broken_heart:":"💔",":two_hearts:":"💕",":sparkling_heart:":"💖",":heartpulse:":"💗",":cupid:":"💘",":blue_heart:":"💙",":green_heart:":"💚",":yellow_heart:":"💛",":purple_heart:":"💜",":gift_heart:":"💝",":revolving_hearts:":"💞",":heart_decoration:":"💟",":diamond_shape_with_a_dot_inside:":"💠",":bulb:":"💡",":anger:":"💢",":bomb:":"💣",":zzz:":"💤",":boom:":"💥",":sweat_drops:":"💦",":droplet:":"💧",":dash:":"💨",":hankey:":"💩",":muscle::skin-tone-1:":"💪🏻",":muscle::skin-tone-2:":"💪🏼",":muscle::skin-tone-3:":"💪🏽",":muscle::skin-tone-4:":"💪🏾",":muscle::skin-tone-5:":"💪🏿",":muscle:":"💪",":dizzy:":"💫",":speech_balloon:":"💬",":thought_balloon:":"💭",":white_flower:":"💮",":100:":"💯",":moneybag:":"💰",":currency_exchange:":"💱",":heavy_dollar_sign:":"💲",":credit_card:":"💳",":yen:":"💴",":dollar:":"💵",":euro:":"💶",":pound:":"💷",":money_with_wings:":"💸",":chart:":"💹",":seat:":"💺",":computer:":"💻",":briefcase:":"💼",":minidisc:":"💽",":floppy_disk:":"💾",":cd:":"💿",":dvd:":"📀",":file_folder:":"📁",":open_file_folder:":"📂",":page_with_curl:":"📃",":page_facing_up:":"📄",":date:":"📅",":calendar:":"📆",":card_index:":"📇",":chart_with_upwards_trend:":"📈",":chart_with_downwards_trend:":"📉",":bar_chart:":"📊",":clipboard:":"📋",":pushpin:":"📌",":round_pushpin:":"📍",":paperclip:":"📎",":straight_ruler:":"📏",":triangular_ruler:":"📐",":bookmark_tabs:":"📑",":ledger:":"📒",":notebook:":"📓",":notebook_with_decorative_cover:":"📔",":closed_book:":"📕",":book:":"📖",":green_book:":"📗",":blue_book:":"📘",":orange_book:":"📙",":books:":"📚",":name_badge:":"📛",":scroll:":"📜",":memo:":"📝",":telephone_receiver:":"📞",":pager:":"📟",":fax:":"📠",":satellite_antenna:":"📡",":loudspeaker:":"📢",":mega:":"📣",":outbox_tray:":"📤",":inbox_tray:":"📥",":package:":"📦",":e-mail:":"📧",":incoming_envelope:":"📨",":envelope_with_arrow:":"📩",":mailbox_closed:":"📪",":mailbox:":"📫",":mailbox_with_mail:":"📬",":mailbox_with_no_mail:":"📭",":postbox:":"📮",":postal_horn:":"📯",":newspaper:":"📰",":iphone:":"📱",":calling:":"📲",":vibration_mode:":"📳",":mobile_phone_off:":"📴",":no_mobile_phones:":"📵",":signal_strength:":"📶",":camera:":"📷",":camera_with_flash:":"📸",":video_camera:":"📹",":tv:":"📺",":radio:":"📻",":vhs:":"📼",":film_projector:":"📽",":prayer_beads:":"📿",":twisted_rightwards_arrows:":"🔀",":repeat:":"🔁",":repeat_one:":"🔂",":arrows_clockwise:":"🔃",":arrows_counterclockwise:":"🔄",":low_brightness:":"🔅",":high_brightness:":"🔆",":mute:":"🔇",":speaker:":"🔈",":sound:":"🔉",":loud_sound:":"🔊",":battery:":"🔋",":electric_plug:":"🔌",":mag:":"🔍",":mag_right:":"🔎",":lock_with_ink_pen:":"🔏",":closed_lock_with_key:":"🔐",":key:":"🔑",":lock:":"🔒",":unlock:":"🔓",":bell:":"🔔",":no_bell:":"🔕",":bookmark:":"🔖",":link:":"🔗",":radio_button:":"🔘",":back:":"🔙",":end:":"🔚",":on:":"🔛",":soon:":"🔜",":top:":"🔝",":underage:":"🔞",":keycap_ten:":"🔟",":capital_abcd:":"🔠",":abcd:":"🔡",":1234:":"🔢",":symbols:":"🔣",":abc:":"🔤",":fire:":"🔥",":flashlight:":"🔦",":wrench:":"🔧",":hammer:":"🔨",":nut_and_bolt:":"🔩",":hocho:":"🔪",":gun:":"🔫",":microscope:":"🔬",":telescope:":"🔭",":crystal_ball:":"🔮",":six_pointed_star:":"🔯",":beginner:":"🔰",":trident:":"🔱",":black_square_button:":"🔲",":white_square_button:":"🔳",":red_circle:":"🔴",":large_blue_circle:":"🔵",":large_orange_diamond:":"🔶",":large_blue_diamond:":"🔷",":small_orange_diamond:":"🔸",":small_blue_diamond:":"🔹",":small_red_triangle:":"🔺",":small_red_triangle_down:":"🔻",":arrow_up_small:":"🔼",":arrow_down_small:":"🔽",":om_symbol:":"🕉",":dove_of_peace:":"🕊",":kaaba:":"🕋",":mosque:":"🕌",":synagogue:":"🕍",":menorah_with_nine_branches:":"🕎",":clock1:":"🕐",":clock2:":"🕑",":clock3:":"🕒",":clock4:":"🕓",":clock5:":"🕔",":clock6:":"🕕",":clock7:":"🕖",":clock8:":"🕗",":clock9:":"🕘",":clock10:":"🕙",":clock11:":"🕚",":clock12:":"🕛",":clock130:":"🕜",":clock230:":"🕝",":clock330:":"🕞",":clock430:":"🕟",":clock530:":"🕠",":clock630:":"🕡",":clock730:":"🕢",":clock830:":"🕣",":clock930:":"🕤",":clock1030:":"🕥",":clock1130:":"🕦",":clock1230:":"🕧",":candle:":"🕯",":mantelpiece_clock:":"🕰",":hole:":"🕳",":man_in_business_suit_levitating::skin-tone-1:":"🕴🏻",":man_in_business_suit_levitating::skin-tone-2:":"🕴🏼",":man_in_business_suit_levitating::skin-tone-3:":"🕴🏽",":man_in_business_suit_levitating::skin-tone-4:":"🕴🏾",":man_in_business_suit_levitating::skin-tone-5:":"🕴🏿",":man_in_business_suit_levitating:":"🕴",":sleuth_or_spy::skin-tone-1:":"🕵🏻",":sleuth_or_spy::skin-tone-2:":"🕵🏼",":sleuth_or_spy::skin-tone-3:":"🕵🏽",":sleuth_or_spy::skin-tone-4:":"🕵🏾",":sleuth_or_spy::skin-tone-5:":"🕵🏿",":sleuth_or_spy:":"🕵",":dark_sunglasses:":"🕶",":spider:":"🕷",":spider_web:":"🕸",":joystick:":"🕹",":man_dancing::skin-tone-1:":"🕺🏻",":man_dancing::skin-tone-2:":"🕺🏼",":man_dancing::skin-tone-3:":"🕺🏽",":man_dancing::skin-tone-4:":"🕺🏾",":man_dancing::skin-tone-5:":"🕺🏿",":man_dancing:":"🕺",":linked_paperclips:":"🖇",":lower_left_ballpoint_pen:":"🖊",":lower_left_fountain_pen:":"🖋",":lower_left_paintbrush:":"🖌",":lower_left_crayon:":"🖍",":raised_hand_with_fingers_splayed::skin-tone-1:":"🖐🏻",":raised_hand_with_fingers_splayed::skin-tone-2:":"🖐🏼",":raised_hand_with_fingers_splayed::skin-tone-3:":"🖐🏽",":raised_hand_with_fingers_splayed::skin-tone-4:":"🖐🏾",":raised_hand_with_fingers_splayed::skin-tone-5:":"🖐🏿",":raised_hand_with_fingers_splayed:":"🖐",":middle_finger::skin-tone-1:":"🖕🏻",":middle_finger::skin-tone-2:":"🖕🏼",":middle_finger::skin-tone-3:":"🖕🏽",":middle_finger::skin-tone-4:":"🖕🏾",":middle_finger::skin-tone-5:":"🖕🏿",":middle_finger:":"🖕",":spock-hand::skin-tone-1:":"🖖🏻",":spock-hand::skin-tone-2:":"🖖🏼",":spock-hand::skin-tone-3:":"🖖🏽",":spock-hand::skin-tone-4:":"🖖🏾",":spock-hand::skin-tone-5:":"🖖🏿",":spock-hand:":"🖖",":black_heart:":"🖤",":desktop_computer:":"🖥",":printer:":"🖨",":three_button_mouse:":"🖱",":trackball:":"🖲",":frame_with_picture:":"🖼",":card_index_dividers:":"🗂",":card_file_box:":"🗃",":file_cabinet:":"🗄",":wastebasket:":"🗑",":spiral_note_pad:":"🗒",":spiral_calendar_pad:":"🗓",":compression:":"🗜",":old_key:":"🗝",":rolled_up_newspaper:":"🗞",":dagger_knife:":"🗡",":speaking_head_in_silhouette:":"🗣",":left_speech_bubble:":"🗨",":right_anger_bubble:":"🗯",":ballot_box_with_ballot:":"🗳",":world_map:":"🗺",":mount_fuji:":"🗻",":tokyo_tower:":"🗼",":statue_of_liberty:":"🗽",":japan:":"🗾",":moyai:":"🗿",":grinning:":"😀",":grin:":"😁",":joy:":"😂",":smiley:":"😃",":smile:":"😄",":sweat_smile:":"😅",":laughing:":"😆",":innocent:":"😇",":smiling_imp:":"😈",":wink:":"😉",":blush:":"😊",":yum:":"😋",":relieved:":"😌",":heart_eyes:":"😍",":sunglasses:":"😎",":smirk:":"😏",":neutral_face:":"😐",":expressionless:":"😑",":unamused:":"😒",":sweat:":"😓",":pensive:":"😔",":confused:":"😕",":confounded:":"😖",":kissing:":"😗",":kissing_heart:":"😘",":kissing_smiling_eyes:":"😙",":kissing_closed_eyes:":"😚",":stuck_out_tongue:":"😛",":stuck_out_tongue_winking_eye:":"😜",":stuck_out_tongue_closed_eyes:":"😝",":disappointed:":"😞",":worried:":"😟",":angry:":"😠",":rage:":"😡",":cry:":"😢",":persevere:":"😣",":triumph:":"😤",":disappointed_relieved:":"😥",":frowning:":"😦",":anguished:":"😧",":fearful:":"😨",":weary:":"😩",":sleepy:":"😪",":tired_face:":"😫",":grimacing:":"😬",":sob:":"😭",":open_mouth:":"😮",":hushed:":"😯",":cold_sweat:":"😰",":scream:":"😱",":astonished:":"😲",":flushed:":"😳",":sleeping:":"😴",":dizzy_face:":"😵",":no_mouth:":"😶",":mask:":"😷",":smile_cat:":"😸",":joy_cat:":"😹",":smiley_cat:":"😺",":heart_eyes_cat:":"😻",":smirk_cat:":"😼",":kissing_cat:":"😽",":pouting_cat:":"😾",":crying_cat_face:":"😿",":scream_cat:":"🙀",":slightly_frowning_face:":"🙁",":slightly_smiling_face:":"🙂",":upside_down_face:":"🙃",":face_with_rolling_eyes:":"🙄",":no_good::skin-tone-1:":"🙅🏻",":no_good::skin-tone-2:":"🙅🏼",":no_good::skin-tone-3:":"🙅🏽",":no_good::skin-tone-4:":"🙅🏾",":no_good::skin-tone-5:":"🙅🏿",":no_good:":"🙅",":ok_woman::skin-tone-1:":"🙆🏻",":ok_woman::skin-tone-2:":"🙆🏼",":ok_woman::skin-tone-3:":"🙆🏽",":ok_woman::skin-tone-4:":"🙆🏾",":ok_woman::skin-tone-5:":"🙆🏿",":ok_woman:":"🙆",":bow::skin-tone-1:":"🙇🏻",":bow::skin-tone-2:":"🙇🏼",":bow::skin-tone-3:":"🙇🏽",":bow::skin-tone-4:":"🙇🏾",":bow::skin-tone-5:":"🙇🏿",":bow:":"🙇",":see_no_evil:":"🙈",":hear_no_evil:":"🙉",":speak_no_evil:":"🙊",":raising_hand::skin-tone-1:":"🙋🏻",":raising_hand::skin-tone-2:":"🙋🏼",":raising_hand::skin-tone-3:":"🙋🏽",":raising_hand::skin-tone-4:":"🙋🏾",":raising_hand::skin-tone-5:":"🙋🏿",":raising_hand:":"🙋",":raised_hands::skin-tone-1:":"🙌🏻",":raised_hands::skin-tone-2:":"🙌🏼",":raised_hands::skin-tone-3:":"🙌🏽",":raised_hands::skin-tone-4:":"🙌🏾",":raised_hands::skin-tone-5:":"🙌🏿",":raised_hands:":"🙌",":person_frowning::skin-tone-1:":"🙍🏻",":person_frowning::skin-tone-2:":"🙍🏼",":person_frowning::skin-tone-3:":"🙍🏽",":person_frowning::skin-tone-4:":"🙍🏾",":person_frowning::skin-tone-5:":"🙍🏿",":person_frowning:":"🙍",":person_with_pouting_face::skin-tone-1:":"🙎🏻",":person_with_pouting_face::skin-tone-2:":"🙎🏼",":person_with_pouting_face::skin-tone-3:":"🙎🏽",":person_with_pouting_face::skin-tone-4:":"🙎🏾",":person_with_pouting_face::skin-tone-5:":"🙎🏿",":person_with_pouting_face:":"🙎",":pray::skin-tone-1:":"🙏🏻",":pray::skin-tone-2:":"🙏🏼",":pray::skin-tone-3:":"🙏🏽",":pray::skin-tone-4:":"🙏🏾",":pray::skin-tone-5:":"🙏🏿",":pray:":"🙏",":rocket:":"🚀",":helicopter:":"🚁",":steam_locomotive:":"🚂",":railway_car:":"🚃",":bullettrain_side:":"🚄",":bullettrain_front:":"🚅",":train2:":"🚆",":metro:":"🚇",":light_rail:":"🚈",":station:":"🚉",":tram:":"🚊",":train:":"🚋",":bus:":"🚌",":oncoming_bus:":"🚍",":trolleybus:":"🚎",":busstop:":"🚏",":minibus:":"🚐",":ambulance:":"🚑",":fire_engine:":"🚒",":police_car:":"🚓",":oncoming_police_car:":"🚔",":taxi:":"🚕",":oncoming_taxi:":"🚖",":car:":"🚗",":oncoming_automobile:":"🚘",":blue_car:":"🚙",":truck:":"🚚",":articulated_lorry:":"🚛",":tractor:":"🚜",":monorail:":"🚝",":mountain_railway:":"🚞",":suspension_railway:":"🚟",":mountain_cableway:":"🚠",":aerial_tramway:":"🚡",":ship:":"🚢",":rowboat::skin-tone-1:":"🚣🏻",":rowboat::skin-tone-2:":"🚣🏼",":rowboat::skin-tone-3:":"🚣🏽",":rowboat::skin-tone-4:":"🚣🏾",":rowboat::skin-tone-5:":"🚣🏿",":rowboat:":"🚣",":speedboat:":"🚤",":traffic_light:":"🚥",":vertical_traffic_light:":"🚦",":construction:":"🚧",":rotating_light:":"🚨",":triangular_flag_on_post:":"🚩",":door:":"🚪",":no_entry_sign:":"🚫",":smoking:":"🚬",":no_smoking:":"🚭",":put_litter_in_its_place:":"🚮",":do_not_litter:":"🚯",":potable_water:":"🚰",":non-potable_water:":"🚱",":bike:":"🚲",":no_bicycles:":"🚳",":bicyclist::skin-tone-1:":"🚴🏻",":bicyclist::skin-tone-2:":"🚴🏼",":bicyclist::skin-tone-3:":"🚴🏽",":bicyclist::skin-tone-4:":"🚴🏾",":bicyclist::skin-tone-5:":"🚴🏿",":bicyclist:":"🚴",":mountain_bicyclist::skin-tone-1:":"🚵🏻",":mountain_bicyclist::skin-tone-2:":"🚵🏼",":mountain_bicyclist::skin-tone-3:":"🚵🏽",":mountain_bicyclist::skin-tone-4:":"🚵🏾",":mountain_bicyclist::skin-tone-5:":"🚵🏿",":mountain_bicyclist:":"🚵",":walking::skin-tone-1:":"🚶🏻",":walking::skin-tone-2:":"🚶🏼",":walking::skin-tone-3:":"🚶🏽",":walking::skin-tone-4:":"🚶🏾",":walking::skin-tone-5:":"🚶🏿",":walking:":"🚶",":no_pedestrians:":"🚷",":children_crossing:":"🚸",":mens:":"🚹",":womens:":"🚺",":restroom:":"🚻",":baby_symbol:":"🚼",":toilet:":"🚽",":wc:":"🚾",":shower:":"🚿",":bath::skin-tone-1:":"🛀🏻",":bath::skin-tone-2:":"🛀🏼",":bath::skin-tone-3:":"🛀🏽",":bath::skin-tone-4:":"🛀🏾",":bath::skin-tone-5:":"🛀🏿",":bath:":"🛀",":bathtub:":"🛁",":passport_control:":"🛂",":customs:":"🛃",":baggage_claim:":"🛄",":left_luggage:":"🛅",":couch_and_lamp:":"🛋",":sleeping_accommodation::skin-tone-1:":"🛌🏻",":sleeping_accommodation::skin-tone-2:":"🛌🏼",":sleeping_accommodation::skin-tone-3:":"🛌🏽",":sleeping_accommodation::skin-tone-4:":"🛌🏾",":sleeping_accommodation::skin-tone-5:":"🛌🏿",":sleeping_accommodation:":"🛌",":shopping_bags:":"🛍",":bellhop_bell:":"🛎",":bed:":"🛏",":place_of_worship:":"🛐",":octagonal_sign:":"🛑",":shopping_trolley:":"🛒",":hammer_and_wrench:":"🛠",":shield:":"🛡",":oil_drum:":"🛢",":motorway:":"🛣",":railway_track:":"🛤",":motor_boat:":"🛥",":small_airplane:":"🛩",":airplane_departure:":"🛫",":airplane_arriving:":"🛬",":satellite:":"🛰",":passenger_ship:":"🛳",":scooter:":"🛴",":motor_scooter:":"🛵",":canoe:":"🛶",":zipper_mouth_face:":"🤐",":money_mouth_face:":"🤑",":face_with_thermometer:":"🤒",":nerd_face:":"🤓",":thinking_face:":"🤔",":face_with_head_bandage:":"🤕",":robot_face:":"🤖",":hugging_face:":"🤗",":the_horns::skin-tone-1:":"🤘🏻",":the_horns::skin-tone-2:":"🤘🏼",":the_horns::skin-tone-3:":"🤘🏽",":the_horns::skin-tone-4:":"🤘🏾",":the_horns::skin-tone-5:":"🤘🏿",":the_horns:":"🤘",":call_me_hand::skin-tone-1:":"🤙🏻",":call_me_hand::skin-tone-2:":"🤙🏼",":call_me_hand::skin-tone-3:":"🤙🏽",":call_me_hand::skin-tone-4:":"🤙🏾",":call_me_hand::skin-tone-5:":"🤙🏿",":call_me_hand:":"🤙",":raised_back_of_hand::skin-tone-1:":"🤚🏻",":raised_back_of_hand::skin-tone-2:":"🤚🏼",":raised_back_of_hand::skin-tone-3:":"🤚🏽",":raised_back_of_hand::skin-tone-4:":"🤚🏾",":raised_back_of_hand::skin-tone-5:":"🤚🏿",":raised_back_of_hand:":"🤚",":left-facing_fist::skin-tone-1:":"🤛🏻",":left-facing_fist::skin-tone-2:":"🤛🏼",":left-facing_fist::skin-tone-3:":"🤛🏽",":left-facing_fist::skin-tone-4:":"🤛🏾",":left-facing_fist::skin-tone-5:":"🤛🏿",":left-facing_fist:":"🤛",":right-facing_fist::skin-tone-1:":"🤜🏻",":right-facing_fist::skin-tone-2:":"🤜🏼",":right-facing_fist::skin-tone-3:":"🤜🏽",":right-facing_fist::skin-tone-4:":"🤜🏾",":right-facing_fist::skin-tone-5:":"🤜🏿",":right-facing_fist:":"🤜",":handshake:":"🤝",":hand_with_index_and_middle_fingers_crossed::skin-tone-1:":"🤞🏻",":hand_with_index_and_middle_fingers_crossed::skin-tone-2:":"🤞🏼",":hand_with_index_and_middle_fingers_crossed::skin-tone-3:":"🤞🏽",":hand_with_index_and_middle_fingers_crossed::skin-tone-4:":"🤞🏾",":hand_with_index_and_middle_fingers_crossed::skin-tone-5:":"🤞🏿",":hand_with_index_and_middle_fingers_crossed:":"🤞",":face_with_cowboy_hat:":"🤠",":clown_face:":"🤡",":nauseated_face:":"🤢",":rolling_on_the_floor_laughing:":"🤣",":drooling_face:":"🤤",":lying_face:":"🤥",":face_palm::skin-tone-1:":"🤦🏻",":face_palm::skin-tone-2:":"🤦🏼",":face_palm::skin-tone-3:":"🤦🏽",":face_palm::skin-tone-4:":"🤦🏾",":face_palm::skin-tone-5:":"🤦🏿",":face_palm:":"🤦",":sneezing_face:":"🤧",":pregnant_woman::skin-tone-1:":"🤰🏻",":pregnant_woman::skin-tone-2:":"🤰🏼",":pregnant_woman::skin-tone-3:":"🤰🏽",":pregnant_woman::skin-tone-4:":"🤰🏾",":pregnant_woman::skin-tone-5:":"🤰🏿",":pregnant_woman:":"🤰",":selfie::skin-tone-1:":"🤳🏻",":selfie::skin-tone-2:":"🤳🏼",":selfie::skin-tone-3:":"🤳🏽",":selfie::skin-tone-4:":"🤳🏾",":selfie::skin-tone-5:":"🤳🏿",":selfie:":"🤳",":prince::skin-tone-1:":"🤴🏻",":prince::skin-tone-2:":"🤴🏼",":prince::skin-tone-3:":"🤴🏽",":prince::skin-tone-4:":"🤴🏾",":prince::skin-tone-5:":"🤴🏿",":prince:":"🤴",":man_in_tuxedo::skin-tone-1:":"🤵🏻",":man_in_tuxedo::skin-tone-2:":"🤵🏼",":man_in_tuxedo::skin-tone-3:":"🤵🏽",":man_in_tuxedo::skin-tone-4:":"🤵🏾",":man_in_tuxedo::skin-tone-5:":"🤵🏿",":man_in_tuxedo:":"🤵",":mother_christmas::skin-tone-1:":"🤶🏻",":mother_christmas::skin-tone-2:":"🤶🏼",":mother_christmas::skin-tone-3:":"🤶🏽",":mother_christmas::skin-tone-4:":"🤶🏾",":mother_christmas::skin-tone-5:":"🤶🏿",":mother_christmas:":"🤶",":shrug::skin-tone-1:":"🤷🏻",":shrug::skin-tone-2:":"🤷🏼",":shrug::skin-tone-3:":"🤷🏽",":shrug::skin-tone-4:":"🤷🏾",":shrug::skin-tone-5:":"🤷🏿",":shrug:":"🤷",":person_doing_cartwheel::skin-tone-1:":"🤸🏻",":person_doing_cartwheel::skin-tone-2:":"🤸🏼",":person_doing_cartwheel::skin-tone-3:":"🤸🏽",":person_doing_cartwheel::skin-tone-4:":"🤸🏾",":person_doing_cartwheel::skin-tone-5:":"🤸🏿",":person_doing_cartwheel:":"🤸",":juggling::skin-tone-1:":"🤹🏻",":juggling::skin-tone-2:":"🤹🏼",":juggling::skin-tone-3:":"🤹🏽",":juggling::skin-tone-4:":"🤹🏾",":juggling::skin-tone-5:":"🤹🏿",":juggling:":"🤹",":fencer:":"🤺",":wrestlers:":"🤼",":water_polo::skin-tone-1:":"🤽🏻",":water_polo::skin-tone-2:":"🤽🏼",":water_polo::skin-tone-3:":"🤽🏽",":water_polo::skin-tone-4:":"🤽🏾",":water_polo::skin-tone-5:":"🤽🏿",":water_polo:":"🤽",":handball::skin-tone-1:":"🤾🏻",":handball::skin-tone-2:":"🤾🏼",":handball::skin-tone-3:":"🤾🏽",":handball::skin-tone-4:":"🤾🏾",":handball::skin-tone-5:":"🤾🏿",":handball:":"🤾",":wilted_flower:":"🥀",":drum_with_drumsticks:":"🥁",":clinking_glasses:":"🥂",":tumbler_glass:":"🥃",":spoon:":"🥄",":goal_net:":"🥅",":first_place_medal:":"🥇",":second_place_medal:":"🥈",":third_place_medal:":"🥉",":boxing_glove:":"🥊",":martial_arts_uniform:":"🥋",":croissant:":"🥐",":avocado:":"🥑",":cucumber:":"🥒",":bacon:":"🥓",":potato:":"🥔",":carrot:":"🥕",":baguette_bread:":"🥖",":green_salad:":"🥗",":shallow_pan_of_food:":"🥘",":stuffed_flatbread:":"🥙",":egg:":"🥚",":glass_of_milk:":"🥛",":peanuts:":"🥜",":kiwifruit:":"🥝",":pancakes:":"🥞",":crab:":"🦀",":lion_face:":"🦁",":scorpion:":"🦂",":turkey:":"🦃",":unicorn_face:":"🦄",":eagle:":"🦅",":duck:":"🦆",":bat:":"🦇",":shark:":"🦈",":owl:":"🦉",":fox_face:":"🦊",":butterfly:":"🦋",":deer:":"🦌",":gorilla:":"🦍",":lizard:":"🦎",":rhinoceros:":"🦏",":shrimp:":"🦐",":squid:":"🦑",":cheese_wedge:":"🧀",":hash:":"#⃣",":keycap_star:":"*⃣",":zero:":"0⃣",":one:":"1⃣",":two:":"2⃣",":three:":"3⃣",":four:":"4⃣",":five:":"5⃣",":six:":"6⃣",":seven:":"7⃣",":eight:":"8⃣",":nine:":"9⃣",":flag-ac:":"🇦🇨",":flag-ad:":"🇦🇩",":flag-ae:":"🇦🇪",":flag-af:":"🇦🇫",":flag-ag:":"🇦🇬",":flag-ai:":"🇦🇮",":flag-al:":"🇦🇱",":flag-am:":"🇦🇲",":flag-ao:":"🇦🇴",":flag-aq:":"🇦🇶",":flag-ar:":"🇦🇷",":flag-as:":"🇦🇸",":flag-at:":"🇦🇹",":flag-au:":"🇦🇺",":flag-aw:":"🇦🇼",":flag-ax:":"🇦🇽",":flag-az:":"🇦🇿",":flag-ba:":"🇧🇦",":flag-bb:":"🇧🇧",":flag-bd:":"🇧🇩",":flag-be:":"🇧🇪",":flag-bf:":"🇧🇫",":flag-bg:":"🇧🇬",":flag-bh:":"🇧🇭",":flag-bi:":"🇧🇮",":flag-bj:":"🇧🇯",":flag-bl:":"🇧🇱",":flag-bm:":"🇧🇲",":flag-bn:":"🇧🇳",":flag-bo:":"🇧🇴",":flag-bq:":"🇧🇶",":flag-br:":"🇧🇷",":flag-bs:":"🇧🇸",":flag-bt:":"🇧🇹",":flag-bv:":"🇧🇻",":flag-bw:":"🇧🇼",":flag-by:":"🇧🇾",":flag-bz:":"🇧🇿",":flag-ca:":"🇨🇦",":flag-cc:":"🇨🇨",":flag-cd:":"🇨🇩",":flag-cf:":"🇨🇫",":flag-cg:":"🇨🇬",":flag-ch:":"🇨🇭",":flag-ci:":"🇨🇮",":flag-ck:":"🇨🇰",":flag-cl:":"🇨🇱",":flag-cm:":"🇨🇲",":flag-cn:":"🇨🇳",":flag-co:":"🇨🇴",":flag-cp:":"🇨🇵",":flag-cr:":"🇨🇷",":flag-cu:":"🇨🇺",":flag-cv:":"🇨🇻",":flag-cw:":"🇨🇼",":flag-cx:":"🇨🇽",":flag-cy:":"🇨🇾",":flag-cz:":"🇨🇿",":flag-de:":"🇩🇪",":flag-dg:":"🇩🇬",":flag-dj:":"🇩🇯",":flag-dk:":"🇩🇰",":flag-dm:":"🇩🇲",":flag-do:":"🇩🇴",":flag-dz:":"🇩🇿",":flag-ea:":"🇪🇦",":flag-ec:":"🇪🇨",":flag-ee:":"🇪🇪",":flag-eg:":"🇪🇬",":flag-eh:":"🇪🇭",":flag-er:":"🇪🇷",":flag-es:":"🇪🇸",":flag-et:":"🇪🇹",":flag-eu:":"🇪🇺",":flag-fi:":"🇫🇮",":flag-fj:":"🇫🇯",":flag-fk:":"🇫🇰",":flag-fm:":"🇫🇲",":flag-fo:":"🇫🇴",":flag-fr:":"🇫🇷",":flag-ga:":"🇬🇦",":flag-gb:":"🇬🇧",":flag-gd:":"🇬🇩",":flag-ge:":"🇬🇪",":flag-gf:":"🇬🇫",":flag-gg:":"🇬🇬",":flag-gh:":"🇬🇭",":flag-gi:":"🇬🇮",":flag-gl:":"🇬🇱",":flag-gm:":"🇬🇲",":flag-gn:":"🇬🇳",":flag-gp:":"🇬🇵",":flag-gq:":"🇬🇶",":flag-gr:":"🇬🇷",":flag-gs:":"🇬🇸",":flag-gt:":"🇬🇹",":flag-gu:":"🇬🇺",":flag-gw:":"🇬🇼",":flag-gy:":"🇬🇾",":flag-hk:":"🇭🇰",":flag-hm:":"🇭🇲",":flag-hn:":"🇭🇳",":flag-hr:":"🇭🇷",":flag-ht:":"🇭🇹",":flag-hu:":"🇭🇺",":flag-ic:":"🇮🇨",":flag-id:":"🇮🇩",":flag-ie:":"🇮🇪",":flag-il:":"🇮🇱",":flag-im:":"🇮🇲",":flag-in:":"🇮🇳",":flag-io:":"🇮🇴",":flag-iq:":"🇮🇶",":flag-ir:":"🇮🇷",":flag-is:":"🇮🇸",":flag-it:":"🇮🇹",":flag-je:":"🇯🇪",":flag-jm:":"🇯🇲",":flag-jo:":"🇯🇴",":flag-jp:":"🇯🇵",":flag-ke:":"🇰🇪",":flag-kg:":"🇰🇬",":flag-kh:":"🇰🇭",":flag-ki:":"🇰🇮",":flag-km:":"🇰🇲",":flag-kn:":"🇰🇳",":flag-kp:":"🇰🇵",":flag-kr:":"🇰🇷",":flag-kw:":"🇰🇼",":flag-ky:":"🇰🇾",":flag-kz:":"🇰🇿",":flag-la:":"🇱🇦",":flag-lb:":"🇱🇧",":flag-lc:":"🇱🇨",":flag-li:":"🇱🇮",":flag-lk:":"🇱🇰",":flag-lr:":"🇱🇷",":flag-ls:":"🇱🇸",":flag-lt:":"🇱🇹",":flag-lu:":"🇱🇺",":flag-lv:":"🇱🇻",":flag-ly:":"🇱🇾",":flag-ma:":"🇲🇦",":flag-mc:":"🇲🇨",":flag-md:":"🇲🇩",":flag-me:":"🇲🇪",":flag-mf:":"🇲🇫",":flag-mg:":"🇲🇬",":flag-mh:":"🇲🇭",":flag-mk:":"🇲🇰",":flag-ml:":"🇲🇱",":flag-mm:":"🇲🇲",":flag-mn:":"🇲🇳",":flag-mo:":"🇲🇴",":flag-mp:":"🇲🇵",":flag-mq:":"🇲🇶",":flag-mr:":"🇲🇷",":flag-ms:":"🇲🇸",":flag-mt:":"🇲🇹",":flag-mu:":"🇲🇺",":flag-mv:":"🇲🇻",":flag-mw:":"🇲🇼",":flag-mx:":"🇲🇽",":flag-my:":"🇲🇾",":flag-mz:":"🇲🇿",":flag-na:":"🇳🇦",":flag-nc:":"🇳🇨",":flag-ne:":"🇳🇪",":flag-nf:":"🇳🇫",":flag-ng:":"🇳🇬",":flag-ni:":"🇳🇮",":flag-nl:":"🇳🇱",":flag-no:":"🇳🇴",":flag-np:":"🇳🇵",":flag-nr:":"🇳🇷",":flag-nu:":"🇳🇺",":flag-nz:":"🇳🇿",":flag-om:":"🇴🇲",":flag-pa:":"🇵🇦",":flag-pe:":"🇵🇪",":flag-pf:":"🇵🇫",":flag-pg:":"🇵🇬",":flag-ph:":"🇵🇭",":flag-pk:":"🇵🇰",":flag-pl:":"🇵🇱",":flag-pm:":"🇵🇲",":flag-pn:":"🇵🇳",":flag-pr:":"🇵🇷",":flag-ps:":"🇵🇸",":flag-pt:":"🇵🇹",":flag-pw:":"🇵🇼",":flag-py:":"🇵🇾",":flag-qa:":"🇶🇦",":flag-re:":"🇷🇪",":flag-ro:":"🇷🇴",":flag-rs:":"🇷🇸",":flag-ru:":"🇷🇺",":flag-rw:":"🇷🇼",":flag-sa:":"🇸🇦",":flag-sb:":"🇸🇧",":flag-sc:":"🇸🇨",":flag-sd:":"🇸🇩",":flag-se:":"🇸🇪",":flag-sg:":"🇸🇬",":flag-sh:":"🇸🇭",":flag-si:":"🇸🇮",":flag-sj:":"🇸🇯",":flag-sk:":"🇸🇰",":flag-sl:":"🇸🇱",":flag-sm:":"🇸🇲",":flag-sn:":"🇸🇳",":flag-so:":"🇸🇴",":flag-sr:":"🇸🇷",":flag-ss:":"🇸🇸",":flag-st:":"🇸🇹",":flag-sv:":"🇸🇻",":flag-sx:":"🇸🇽",":flag-sy:":"🇸🇾",":flag-sz:":"🇸🇿",":flag-ta:":"🇹🇦",":flag-tc:":"🇹🇨",":flag-td:":"🇹🇩",":flag-tf:":"🇹🇫",":flag-tg:":"🇹🇬",":flag-th:":"🇹🇭",":flag-tj:":"🇹🇯",":flag-tk:":"🇹🇰",":flag-tl:":"🇹🇱",":flag-tm:":"🇹🇲",":flag-tn:":"🇹🇳",":flag-to:":"🇹🇴",":flag-tr:":"🇹🇷",":flag-tt:":"🇹🇹",":flag-tv:":"🇹🇻",":flag-tw:":"🇹🇼",":flag-tz:":"🇹🇿",":flag-ua:":"🇺🇦",":flag-ug:":"🇺🇬",":flag-um:":"🇺🇲",":flag-un:":"🇺🇳",":flag-us:":"🇺🇸",":flag-uy:":"🇺🇾",":flag-uz:":"🇺🇿",":flag-va:":"🇻🇦",":flag-vc:":"🇻🇨",":flag-ve:":"🇻🇪",":flag-vg:":"🇻🇬",":flag-vi:":"🇻🇮",":flag-vn:":"🇻🇳",":flag-vu:":"🇻🇺",":flag-wf:":"🇼🇫",":flag-ws:":"🇼🇸",":flag-xk:":"🇽🇰",":flag-ye:":"🇾🇪",":flag-yt:":"🇾🇹",":flag-za:":"🇿🇦",":flag-zm:":"🇿🇲",":flag-zw:":"🇿🇼",":male-farmer::skin-tone-1:":"👨🏻‍🌾",":male-farmer::skin-tone-2:":"👨🏼‍🌾",":male-farmer::skin-tone-3:":"👨🏽‍🌾",":male-farmer::skin-tone-4:":"👨🏾‍🌾",":male-farmer::skin-tone-5:":"👨🏿‍🌾",":male-farmer:":"👨‍🌾",":male-cook::skin-tone-1:":"👨🏻‍🍳",":male-cook::skin-tone-2:":"👨🏼‍🍳",":male-cook::skin-tone-3:":"👨🏽‍🍳",":male-cook::skin-tone-4:":"👨🏾‍🍳",":male-cook::skin-tone-5:":"👨🏿‍🍳",":male-cook:":"👨‍🍳",":male-student::skin-tone-1:":"👨🏻‍🎓",":male-student::skin-tone-2:":"👨🏼‍🎓",":male-student::skin-tone-3:":"👨🏽‍🎓",":male-student::skin-tone-4:":"👨🏾‍🎓",":male-student::skin-tone-5:":"👨🏿‍🎓",":male-student:":"👨‍🎓",":male-singer::skin-tone-1:":"👨🏻‍🎤",":male-singer::skin-tone-2:":"👨🏼‍🎤",":male-singer::skin-tone-3:":"👨🏽‍🎤",":male-singer::skin-tone-4:":"👨🏾‍🎤",":male-singer::skin-tone-5:":"👨🏿‍🎤",":male-singer:":"👨‍🎤",":male-artist::skin-tone-1:":"👨🏻‍🎨",":male-artist::skin-tone-2:":"👨🏼‍🎨",":male-artist::skin-tone-3:":"👨🏽‍🎨",":male-artist::skin-tone-4:":"👨🏾‍🎨",":male-artist::skin-tone-5:":"👨🏿‍🎨",":male-artist:":"👨‍🎨",":male-teacher::skin-tone-1:":"👨🏻‍🏫",":male-teacher::skin-tone-2:":"👨🏼‍🏫",":male-teacher::skin-tone-3:":"👨🏽‍🏫",":male-teacher::skin-tone-4:":"👨🏾‍🏫",":male-teacher::skin-tone-5:":"👨🏿‍🏫",":male-teacher:":"👨‍🏫",":male-factory-worker::skin-tone-1:":"👨🏻‍🏭",":male-factory-worker::skin-tone-2:":"👨🏼‍🏭",":male-factory-worker::skin-tone-3:":"👨🏽‍🏭",":male-factory-worker::skin-tone-4:":"👨🏾‍🏭",":male-factory-worker::skin-tone-5:":"👨🏿‍🏭",":male-factory-worker:":"👨‍🏭",":man-boy:":"👨‍👦",":man-girl:":"👨‍👧",":male-technologist::skin-tone-1:":"👨🏻‍💻",":male-technologist::skin-tone-2:":"👨🏼‍💻",":male-technologist::skin-tone-3:":"👨🏽‍💻",":male-technologist::skin-tone-4:":"👨🏾‍💻",":male-technologist::skin-tone-5:":"👨🏿‍💻",":male-technologist:":"👨‍💻",":male-office-worker::skin-tone-1:":"👨🏻‍💼",":male-office-worker::skin-tone-2:":"👨🏼‍💼",":male-office-worker::skin-tone-3:":"👨🏽‍💼",":male-office-worker::skin-tone-4:":"👨🏾‍💼",":male-office-worker::skin-tone-5:":"👨🏿‍💼",":male-office-worker:":"👨‍💼",":male-mechanic::skin-tone-1:":"👨🏻‍🔧",":male-mechanic::skin-tone-2:":"👨🏼‍🔧",":male-mechanic::skin-tone-3:":"👨🏽‍🔧",":male-mechanic::skin-tone-4:":"👨🏾‍🔧",":male-mechanic::skin-tone-5:":"👨🏿‍🔧",":male-mechanic:":"👨‍🔧",":male-scientist::skin-tone-1:":"👨🏻‍🔬",":male-scientist::skin-tone-2:":"👨🏼‍🔬",":male-scientist::skin-tone-3:":"👨🏽‍🔬",":male-scientist::skin-tone-4:":"👨🏾‍🔬",":male-scientist::skin-tone-5:":"👨🏿‍🔬",":male-scientist:":"👨‍🔬",":male-astronaut::skin-tone-1:":"👨🏻‍🚀",":male-astronaut::skin-tone-2:":"👨🏼‍🚀",":male-astronaut::skin-tone-3:":"👨🏽‍🚀",":male-astronaut::skin-tone-4:":"👨🏾‍🚀",":male-astronaut::skin-tone-5:":"👨🏿‍🚀",":male-astronaut:":"👨‍🚀",":male-firefighter::skin-tone-1:":"👨🏻‍🚒",":male-firefighter::skin-tone-2:":"👨🏼‍🚒",":male-firefighter::skin-tone-3:":"👨🏽‍🚒",":male-firefighter::skin-tone-4:":"👨🏾‍🚒",":male-firefighter::skin-tone-5:":"👨🏿‍🚒",":male-firefighter:":"👨‍🚒",":female-farmer::skin-tone-1:":"👩🏻‍🌾",":female-farmer::skin-tone-2:":"👩🏼‍🌾",":female-farmer::skin-tone-3:":"👩🏽‍🌾",":female-farmer::skin-tone-4:":"👩🏾‍🌾",":female-farmer::skin-tone-5:":"👩🏿‍🌾",":female-farmer:":"👩‍🌾",":female-cook::skin-tone-1:":"👩🏻‍🍳",":female-cook::skin-tone-2:":"👩🏼‍🍳",":female-cook::skin-tone-3:":"👩🏽‍🍳",":female-cook::skin-tone-4:":"👩🏾‍🍳",":female-cook::skin-tone-5:":"👩🏿‍🍳",":female-cook:":"👩‍🍳",":female-student::skin-tone-1:":"👩🏻‍🎓",":female-student::skin-tone-2:":"👩🏼‍🎓",":female-student::skin-tone-3:":"👩🏽‍🎓",":female-student::skin-tone-4:":"👩🏾‍🎓",":female-student::skin-tone-5:":"👩🏿‍🎓",":female-student:":"👩‍🎓",":female-singer::skin-tone-1:":"👩🏻‍🎤",":female-singer::skin-tone-2:":"👩🏼‍🎤",":female-singer::skin-tone-3:":"👩🏽‍🎤",":female-singer::skin-tone-4:":"👩🏾‍🎤",":female-singer::skin-tone-5:":"👩🏿‍🎤",":female-singer:":"👩‍🎤",":female-artist::skin-tone-1:":"👩🏻‍🎨",":female-artist::skin-tone-2:":"👩🏼‍🎨",":female-artist::skin-tone-3:":"👩🏽‍🎨",":female-artist::skin-tone-4:":"👩🏾‍🎨",":female-artist::skin-tone-5:":"👩🏿‍🎨",":female-artist:":"👩‍🎨",":female-teacher::skin-tone-1:":"👩🏻‍🏫",":female-teacher::skin-tone-2:":"👩🏼‍🏫",":female-teacher::skin-tone-3:":"👩🏽‍🏫",":female-teacher::skin-tone-4:":"👩🏾‍🏫",":female-teacher::skin-tone-5:":"👩🏿‍🏫",":female-teacher:":"👩‍🏫",":female-factory-worker::skin-tone-1:":"👩🏻‍🏭",":female-factory-worker::skin-tone-2:":"👩🏼‍🏭",":female-factory-worker::skin-tone-3:":"👩🏽‍🏭",":female-factory-worker::skin-tone-4:":"👩🏾‍🏭",":female-factory-worker::skin-tone-5:":"👩🏿‍🏭",":female-factory-worker:":"👩‍🏭",":woman-boy:":"👩‍👦",":woman-girl:":"👩‍👧",":female-technologist::skin-tone-1:":"👩🏻‍💻",":female-technologist::skin-tone-2:":"👩🏼‍💻",":female-technologist::skin-tone-3:":"👩🏽‍💻",":female-technologist::skin-tone-4:":"👩🏾‍💻",":female-technologist::skin-tone-5:":"👩🏿‍💻",":female-technologist:":"👩‍💻",":female-office-worker::skin-tone-1:":"👩🏻‍💼",":female-office-worker::skin-tone-2:":"👩🏼‍💼",":female-office-worker::skin-tone-3:":"👩🏽‍💼",":female-office-worker::skin-tone-4:":"👩🏾‍💼",":female-office-worker::skin-tone-5:":"👩🏿‍💼",":female-office-worker:":"👩‍💼",":female-mechanic::skin-tone-1:":"👩🏻‍🔧",":female-mechanic::skin-tone-2:":"👩🏼‍🔧",":female-mechanic::skin-tone-3:":"👩🏽‍🔧",":female-mechanic::skin-tone-4:":"👩🏾‍🔧",":female-mechanic::skin-tone-5:":"👩🏿‍🔧",":female-mechanic:":"👩‍🔧",":female-scientist::skin-tone-1:":"👩🏻‍🔬",":female-scientist::skin-tone-2:":"👩🏼‍🔬",":female-scientist::skin-tone-3:":"👩🏽‍🔬",":female-scientist::skin-tone-4:":"👩🏾‍🔬",":female-scientist::skin-tone-5:":"👩🏿‍🔬",":female-scientist:":"👩‍🔬",":female-astronaut::skin-tone-1:":"👩🏻‍🚀",":female-astronaut::skin-tone-2:":"👩🏼‍🚀",":female-astronaut::skin-tone-3:":"👩🏽‍🚀",":female-astronaut::skin-tone-4:":"👩🏾‍🚀",":female-astronaut::skin-tone-5:":"👩🏿‍🚀",":female-astronaut:":"👩‍🚀",":female-firefighter::skin-tone-1:":"👩🏻‍🚒",":female-firefighter::skin-tone-2:":"👩🏼‍🚒",":female-firefighter::skin-tone-3:":"👩🏽‍🚒",":female-firefighter::skin-tone-4:":"👩🏾‍🚒",":female-firefighter::skin-tone-5:":"👩🏿‍🚒",":female-firefighter:":"👩‍🚒",":woman-running::skin-tone-1:":"🏃🏻‍♀️",":woman-running::skin-tone-2:":"🏃🏼‍♀️",":woman-running::skin-tone-3:":"🏃🏽‍♀️",":woman-running::skin-tone-4:":"🏃🏾‍♀️",":woman-running::skin-tone-5:":"🏃🏿‍♀️",":woman-running:":"🏃‍♀️",":man-running::skin-tone-1:":"🏃🏻‍♂️",":man-running::skin-tone-2:":"🏃🏼‍♂️",":man-running::skin-tone-3:":"🏃🏽‍♂️",":man-running::skin-tone-4:":"🏃🏾‍♂️",":man-running::skin-tone-5:":"🏃🏿‍♂️",":man-running:":"🏃‍♂️",":woman-surfing::skin-tone-1:":"🏄🏻‍♀️",":woman-surfing::skin-tone-2:":"🏄🏼‍♀️",":woman-surfing::skin-tone-3:":"🏄🏽‍♀️",":woman-surfing::skin-tone-4:":"🏄🏾‍♀️",":woman-surfing::skin-tone-5:":"🏄🏿‍♀️",":woman-surfing:":"🏄‍♀️",":man-surfing::skin-tone-1:":"🏄🏻‍♂️",":man-surfing::skin-tone-2:":"🏄🏼‍♂️",":man-surfing::skin-tone-3:":"🏄🏽‍♂️",":man-surfing::skin-tone-4:":"🏄🏾‍♂️",":man-surfing::skin-tone-5:":"🏄🏿‍♂️",":man-surfing:":"🏄‍♂️",":woman-swimming::skin-tone-1:":"🏊🏻‍♀️",":woman-swimming::skin-tone-2:":"🏊🏼‍♀️",":woman-swimming::skin-tone-3:":"🏊🏽‍♀️",":woman-swimming::skin-tone-4:":"🏊🏾‍♀️",":woman-swimming::skin-tone-5:":"🏊🏿‍♀️",":woman-swimming:":"🏊‍♀️",":man-swimming::skin-tone-1:":"🏊🏻‍♂️",":man-swimming::skin-tone-2:":"🏊🏼‍♂️",":man-swimming::skin-tone-3:":"🏊🏽‍♂️",":man-swimming::skin-tone-4:":"🏊🏾‍♂️",":man-swimming::skin-tone-5:":"🏊🏿‍♂️",":man-swimming:":"🏊‍♂️",":woman-lifting-weights::skin-tone-1:":"🏋🏻‍♀️",":woman-lifting-weights::skin-tone-2:":"🏋🏼‍♀️",":woman-lifting-weights::skin-tone-3:":"🏋🏽‍♀️",":woman-lifting-weights::skin-tone-4:":"🏋🏾‍♀️",":woman-lifting-weights::skin-tone-5:":"🏋🏿‍♀️",":woman-lifting-weights:":"🏋️‍♀️",":man-lifting-weights::skin-tone-1:":"🏋🏻‍♂️",":man-lifting-weights::skin-tone-2:":"🏋🏼‍♂️",":man-lifting-weights::skin-tone-3:":"🏋🏽‍♂️",":man-lifting-weights::skin-tone-4:":"🏋🏾‍♂️",":man-lifting-weights::skin-tone-5:":"🏋🏿‍♂️",":man-lifting-weights:":"🏋️‍♂️",":woman-golfing::skin-tone-1:":"🏌🏻‍♀️",":woman-golfing::skin-tone-2:":"🏌🏼‍♀️",":woman-golfing::skin-tone-3:":"🏌🏽‍♀️",":woman-golfing::skin-tone-4:":"🏌🏾‍♀️",":woman-golfing::skin-tone-5:":"🏌🏿‍♀️",":woman-golfing:":"🏌️‍♀️",":man-golfing::skin-tone-1:":"🏌🏻‍♂️",":man-golfing::skin-tone-2:":"🏌🏼‍♂️",":man-golfing::skin-tone-3:":"🏌🏽‍♂️",":man-golfing::skin-tone-4:":"🏌🏾‍♂️",":man-golfing::skin-tone-5:":"🏌🏿‍♂️",":man-golfing:":"🏌️‍♂️",":rainbow-flag:":"🏳️‍🌈",":eye-in-speech-bubble:":"👁️‍🗨️",":man-boy-boy:":"👨‍👦‍👦",":man-girl-boy:":"👨‍👧‍👦",":man-girl-girl:":"👨‍👧‍👧",":man-man-boy:":"👨‍👨‍👦",":man-man-boy-boy:":"👨‍👨‍👦‍👦",":man-man-girl:":"👨‍👨‍👧",":man-man-girl-boy:":"👨‍👨‍👧‍👦",":man-man-girl-girl:":"👨‍👨‍👧‍👧",":man-woman-boy:":"👨‍👩‍👦",":man-woman-boy-boy:":"👨‍👩‍👦‍👦",":man-woman-girl:":"👨‍👩‍👧",":man-woman-girl-boy:":"👨‍👩‍👧‍👦",":man-woman-girl-girl:":"👨‍👩‍👧‍👧",":male-doctor::skin-tone-1:":"👨🏻‍⚕️",":male-doctor::skin-tone-2:":"👨🏼‍⚕️",":male-doctor::skin-tone-3:":"👨🏽‍⚕️",":male-doctor::skin-tone-4:":"👨🏾‍⚕️",":male-doctor::skin-tone-5:":"👨🏿‍⚕️",":male-doctor:":"👨‍⚕️",":male-judge::skin-tone-1:":"👨🏻‍⚖️",":male-judge::skin-tone-2:":"👨🏼‍⚖️",":male-judge::skin-tone-3:":"👨🏽‍⚖️",":male-judge::skin-tone-4:":"👨🏾‍⚖️",":male-judge::skin-tone-5:":"👨🏿‍⚖️",":male-judge:":"👨‍⚖️",":male-pilot::skin-tone-1:":"👨🏻‍✈️",":male-pilot::skin-tone-2:":"👨🏼‍✈️",":male-pilot::skin-tone-3:":"👨🏽‍✈️",":male-pilot::skin-tone-4:":"👨🏾‍✈️",":male-pilot::skin-tone-5:":"👨🏿‍✈️",":male-pilot:":"👨‍✈️",":man-heart-man:":"👨‍❤️‍👨",":man-kiss-man:":"👨‍❤️‍💋‍👨",":woman-boy-boy:":"👩‍👦‍👦",":woman-girl-boy:":"👩‍👧‍👦",":woman-girl-girl:":"👩‍👧‍👧",":woman-woman-boy:":"👩‍👩‍👦",":woman-woman-boy-boy:":"👩‍👩‍👦‍👦",":woman-woman-girl:":"👩‍👩‍👧",":woman-woman-girl-boy:":"👩‍👩‍👧‍👦",":woman-woman-girl-girl:":"👩‍👩‍👧‍👧",":female-doctor::skin-tone-1:":"👩🏻‍⚕️",":female-doctor::skin-tone-2:":"👩🏼‍⚕️",":female-doctor::skin-tone-3:":"👩🏽‍⚕️",":female-doctor::skin-tone-4:":"👩🏾‍⚕️",":female-doctor::skin-tone-5:":"👩🏿‍⚕️",":female-doctor:":"👩‍⚕️",":female-judge::skin-tone-1:":"👩🏻‍⚖️",":female-judge::skin-tone-2:":"👩🏼‍⚖️",":female-judge::skin-tone-3:":"👩🏽‍⚖️",":female-judge::skin-tone-4:":"👩🏾‍⚖️",":female-judge::skin-tone-5:":"👩🏿‍⚖️",":female-judge:":"👩‍⚖️",":female-pilot::skin-tone-1:":"👩🏻‍✈️",":female-pilot::skin-tone-2:":"👩🏼‍✈️",":female-pilot::skin-tone-3:":"👩🏽‍✈️",":female-pilot::skin-tone-4:":"👩🏾‍✈️",":female-pilot::skin-tone-5:":"👩🏿‍✈️",":female-pilot:":"👩‍✈️",":woman-heart-man:":"👩‍❤️‍👨",":woman-heart-woman:":"👩‍❤️‍👩",":woman-kiss-man:":"👩‍❤️‍💋‍👨",":woman-kiss-woman:":"👩‍❤️‍💋‍👩",":female-police-officer::skin-tone-1:":"👮🏻‍♀️",":female-police-officer::skin-tone-2:":"👮🏼‍♀️",":female-police-officer::skin-tone-3:":"👮🏽‍♀️",":female-police-officer::skin-tone-4:":"👮🏾‍♀️",":female-police-officer::skin-tone-5:":"👮🏿‍♀️",":female-police-officer:":"👮‍♀️",":male-police-officer::skin-tone-1:":"👮🏻‍♂️",":male-police-officer::skin-tone-2:":"👮🏼‍♂️",":male-police-officer::skin-tone-3:":"👮🏽‍♂️",":male-police-officer::skin-tone-4:":"👮🏾‍♂️",":male-police-officer::skin-tone-5:":"👮🏿‍♂️",":male-police-officer:":"👮‍♂️",":woman-with-bunny-ears-partying:":"👯‍♀️",":man-with-bunny-ears-partying:":"👯‍♂️",":blond-haired-woman::skin-tone-1:":"👱🏻‍♀️",":blond-haired-woman::skin-tone-2:":"👱🏼‍♀️",":blond-haired-woman::skin-tone-3:":"👱🏽‍♀️",":blond-haired-woman::skin-tone-4:":"👱🏾‍♀️",":blond-haired-woman::skin-tone-5:":"👱🏿‍♀️",":blond-haired-woman:":"👱‍♀️",":blond-haired-man::skin-tone-1:":"👱🏻‍♂️",":blond-haired-man::skin-tone-2:":"👱🏼‍♂️",":blond-haired-man::skin-tone-3:":"👱🏽‍♂️",":blond-haired-man::skin-tone-4:":"👱🏾‍♂️",":blond-haired-man::skin-tone-5:":"👱🏿‍♂️",":blond-haired-man:":"👱‍♂️",":woman-wearing-turban::skin-tone-1:":"👳🏻‍♀️",":woman-wearing-turban::skin-tone-2:":"👳🏼‍♀️",":woman-wearing-turban::skin-tone-3:":"👳🏽‍♀️",":woman-wearing-turban::skin-tone-4:":"👳🏾‍♀️",":woman-wearing-turban::skin-tone-5:":"👳🏿‍♀️",":woman-wearing-turban:":"👳‍♀️",":man-wearing-turban::skin-tone-1:":"👳🏻‍♂️",":man-wearing-turban::skin-tone-2:":"👳🏼‍♂️",":man-wearing-turban::skin-tone-3:":"👳🏽‍♂️",":man-wearing-turban::skin-tone-4:":"👳🏾‍♂️",":man-wearing-turban::skin-tone-5:":"👳🏿‍♂️",":man-wearing-turban:":"👳‍♂️",":female-construction-worker::skin-tone-1:":"👷🏻‍♀️",":female-construction-worker::skin-tone-2:":"👷🏼‍♀️",":female-construction-worker::skin-tone-3:":"👷🏽‍♀️",":female-construction-worker::skin-tone-4:":"👷🏾‍♀️",":female-construction-worker::skin-tone-5:":"👷🏿‍♀️",":female-construction-worker:":"👷‍♀️",":male-construction-worker::skin-tone-1:":"👷🏻‍♂️",":male-construction-worker::skin-tone-2:":"👷🏼‍♂️",":male-construction-worker::skin-tone-3:":"👷🏽‍♂️",":male-construction-worker::skin-tone-4:":"👷🏾‍♂️",":male-construction-worker::skin-tone-5:":"👷🏿‍♂️",":male-construction-worker:":"👷‍♂️",":woman-tipping-hand::skin-tone-1:":"💁🏻‍♀️",":woman-tipping-hand::skin-tone-2:":"💁🏼‍♀️",":woman-tipping-hand::skin-tone-3:":"💁🏽‍♀️",":woman-tipping-hand::skin-tone-4:":"💁🏾‍♀️",":woman-tipping-hand::skin-tone-5:":"💁🏿‍♀️",":woman-tipping-hand:":"💁‍♀️",":man-tipping-hand::skin-tone-1:":"💁🏻‍♂️",":man-tipping-hand::skin-tone-2:":"💁🏼‍♂️",":man-tipping-hand::skin-tone-3:":"💁🏽‍♂️",":man-tipping-hand::skin-tone-4:":"💁🏾‍♂️",":man-tipping-hand::skin-tone-5:":"💁🏿‍♂️",":man-tipping-hand:":"💁‍♂️",":female-guard::skin-tone-1:":"💂🏻‍♀️",":female-guard::skin-tone-2:":"💂🏼‍♀️",":female-guard::skin-tone-3:":"💂🏽‍♀️",":female-guard::skin-tone-4:":"💂🏾‍♀️",":female-guard::skin-tone-5:":"💂🏿‍♀️",":female-guard:":"💂‍♀️",":male-guard::skin-tone-1:":"💂🏻‍♂️",":male-guard::skin-tone-2:":"💂🏼‍♂️",":male-guard::skin-tone-3:":"💂🏽‍♂️",":male-guard::skin-tone-4:":"💂🏾‍♂️",":male-guard::skin-tone-5:":"💂🏿‍♂️",":male-guard:":"💂‍♂️",":woman-getting-massage::skin-tone-1:":"💆🏻‍♀️",":woman-getting-massage::skin-tone-2:":"💆🏼‍♀️",":woman-getting-massage::skin-tone-3:":"💆🏽‍♀️",":woman-getting-massage::skin-tone-4:":"💆🏾‍♀️",":woman-getting-massage::skin-tone-5:":"💆🏿‍♀️",":woman-getting-massage:":"💆‍♀️",":man-getting-massage::skin-tone-1:":"💆🏻‍♂️",":man-getting-massage::skin-tone-2:":"💆🏼‍♂️",":man-getting-massage::skin-tone-3:":"💆🏽‍♂️",":man-getting-massage::skin-tone-4:":"💆🏾‍♂️",":man-getting-massage::skin-tone-5:":"💆🏿‍♂️",":man-getting-massage:":"💆‍♂️",":woman-getting-haircut::skin-tone-1:":"💇🏻‍♀️",":woman-getting-haircut::skin-tone-2:":"💇🏼‍♀️",":woman-getting-haircut::skin-tone-3:":"💇🏽‍♀️",":woman-getting-haircut::skin-tone-4:":"💇🏾‍♀️",":woman-getting-haircut::skin-tone-5:":"💇🏿‍♀️",":woman-getting-haircut:":"💇‍♀️",":man-getting-haircut::skin-tone-1:":"💇🏻‍♂️",":man-getting-haircut::skin-tone-2:":"💇🏼‍♂️",":man-getting-haircut::skin-tone-3:":"💇🏽‍♂️",":man-getting-haircut::skin-tone-4:":"💇🏾‍♂️",":man-getting-haircut::skin-tone-5:":"💇🏿‍♂️",":man-getting-haircut:":"💇‍♂️",":female-detective::skin-tone-1:":"🕵🏻‍♀️",":female-detective::skin-tone-2:":"🕵🏼‍♀️",":female-detective::skin-tone-3:":"🕵🏽‍♀️",":female-detective::skin-tone-4:":"🕵🏾‍♀️",":female-detective::skin-tone-5:":"🕵🏿‍♀️",":female-detective:":"🕵️‍♀️",":male-detective::skin-tone-1:":"🕵🏻‍♂️",":male-detective::skin-tone-2:":"🕵🏼‍♂️",":male-detective::skin-tone-3:":"🕵🏽‍♂️",":male-detective::skin-tone-4:":"🕵🏾‍♂️",":male-detective::skin-tone-5:":"🕵🏿‍♂️",":male-detective:":"🕵️‍♂️",":woman-gesturing-no::skin-tone-1:":"🙅🏻‍♀️",":woman-gesturing-no::skin-tone-2:":"🙅🏼‍♀️",":woman-gesturing-no::skin-tone-3:":"🙅🏽‍♀️",":woman-gesturing-no::skin-tone-4:":"🙅🏾‍♀️",":woman-gesturing-no::skin-tone-5:":"🙅🏿‍♀️",":woman-gesturing-no:":"🙅‍♀️",":man-gesturing-no::skin-tone-1:":"🙅🏻‍♂️",":man-gesturing-no::skin-tone-2:":"🙅🏼‍♂️",":man-gesturing-no::skin-tone-3:":"🙅🏽‍♂️",":man-gesturing-no::skin-tone-4:":"🙅🏾‍♂️",":man-gesturing-no::skin-tone-5:":"🙅🏿‍♂️",":man-gesturing-no:":"🙅‍♂️",":woman-gesturing-ok::skin-tone-1:":"🙆🏻‍♀️",":woman-gesturing-ok::skin-tone-2:":"🙆🏼‍♀️",":woman-gesturing-ok::skin-tone-3:":"🙆🏽‍♀️",":woman-gesturing-ok::skin-tone-4:":"🙆🏾‍♀️",":woman-gesturing-ok::skin-tone-5:":"🙆🏿‍♀️",":woman-gesturing-ok:":"🙆‍♀️",":man-gesturing-ok::skin-tone-1:":"🙆🏻‍♂️",":man-gesturing-ok::skin-tone-2:":"🙆🏼‍♂️",":man-gesturing-ok::skin-tone-3:":"🙆🏽‍♂️",":man-gesturing-ok::skin-tone-4:":"🙆🏾‍♂️",":man-gesturing-ok::skin-tone-5:":"🙆🏿‍♂️",":man-gesturing-ok:":"🙆‍♂️",":woman-bowing::skin-tone-1:":"🙇🏻‍♀️",":woman-bowing::skin-tone-2:":"🙇🏼‍♀️",":woman-bowing::skin-tone-3:":"🙇🏽‍♀️",":woman-bowing::skin-tone-4:":"🙇🏾‍♀️",":woman-bowing::skin-tone-5:":"🙇🏿‍♀️",":woman-bowing:":"🙇‍♀️",":man-bowing::skin-tone-1:":"🙇🏻‍♂️",":man-bowing::skin-tone-2:":"🙇🏼‍♂️",":man-bowing::skin-tone-3:":"🙇🏽‍♂️",":man-bowing::skin-tone-4:":"🙇🏾‍♂️",":man-bowing::skin-tone-5:":"🙇🏿‍♂️",":man-bowing:":"🙇‍♂️",":woman-raising-hand::skin-tone-1:":"🙋🏻‍♀️",":woman-raising-hand::skin-tone-2:":"🙋🏼‍♀️",":woman-raising-hand::skin-tone-3:":"🙋🏽‍♀️",":woman-raising-hand::skin-tone-4:":"🙋🏾‍♀️",":woman-raising-hand::skin-tone-5:":"🙋🏿‍♀️",":woman-raising-hand:":"🙋‍♀️",":man-raising-hand::skin-tone-1:":"🙋🏻‍♂️",":man-raising-hand::skin-tone-2:":"🙋🏼‍♂️",":man-raising-hand::skin-tone-3:":"🙋🏽‍♂️",":man-raising-hand::skin-tone-4:":"🙋🏾‍♂️",":man-raising-hand::skin-tone-5:":"🙋🏿‍♂️",":man-raising-hand:":"🙋‍♂️",":woman-frowning::skin-tone-1:":"🙍🏻‍♀️",":woman-frowning::skin-tone-2:":"🙍🏼‍♀️",":woman-frowning::skin-tone-3:":"🙍🏽‍♀️",":woman-frowning::skin-tone-4:":"🙍🏾‍♀️",":woman-frowning::skin-tone-5:":"🙍🏿‍♀️",":woman-frowning:":"🙍‍♀️",":man-frowning::skin-tone-1:":"🙍🏻‍♂️",":man-frowning::skin-tone-2:":"🙍🏼‍♂️",":man-frowning::skin-tone-3:":"🙍🏽‍♂️",":man-frowning::skin-tone-4:":"🙍🏾‍♂️",":man-frowning::skin-tone-5:":"🙍🏿‍♂️",":man-frowning:":"🙍‍♂️",":woman-pouting::skin-tone-1:":"🙎🏻‍♀️",":woman-pouting::skin-tone-2:":"🙎🏼‍♀️",":woman-pouting::skin-tone-3:":"🙎🏽‍♀️",":woman-pouting::skin-tone-4:":"🙎🏾‍♀️",":woman-pouting::skin-tone-5:":"🙎🏿‍♀️",":woman-pouting:":"🙎‍♀️",":man-pouting::skin-tone-1:":"🙎🏻‍♂️",":man-pouting::skin-tone-2:":"🙎🏼‍♂️",":man-pouting::skin-tone-3:":"🙎🏽‍♂️",":man-pouting::skin-tone-4:":"🙎🏾‍♂️",":man-pouting::skin-tone-5:":"🙎🏿‍♂️",":man-pouting:":"🙎‍♂️",":woman-rowing-boat::skin-tone-1:":"🚣🏻‍♀️",":woman-rowing-boat::skin-tone-2:":"🚣🏼‍♀️",":woman-rowing-boat::skin-tone-3:":"🚣🏽‍♀️",":woman-rowing-boat::skin-tone-4:":"🚣🏾‍♀️",":woman-rowing-boat::skin-tone-5:":"🚣🏿‍♀️",":woman-rowing-boat:":"🚣‍♀️",":man-rowing-boat::skin-tone-1:":"🚣🏻‍♂️",":man-rowing-boat::skin-tone-2:":"🚣🏼‍♂️",":man-rowing-boat::skin-tone-3:":"🚣🏽‍♂️",":man-rowing-boat::skin-tone-4:":"🚣🏾‍♂️",":man-rowing-boat::skin-tone-5:":"🚣🏿‍♂️",":man-rowing-boat:":"🚣‍♂️",":woman-biking::skin-tone-1:":"🚴🏻‍♀️",":woman-biking::skin-tone-2:":"🚴🏼‍♀️",":woman-biking::skin-tone-3:":"🚴🏽‍♀️",":woman-biking::skin-tone-4:":"🚴🏾‍♀️",":woman-biking::skin-tone-5:":"🚴🏿‍♀️",":woman-biking:":"🚴‍♀️",":man-biking::skin-tone-1:":"🚴🏻‍♂️",":man-biking::skin-tone-2:":"🚴🏼‍♂️",":man-biking::skin-tone-3:":"🚴🏽‍♂️",":man-biking::skin-tone-4:":"🚴🏾‍♂️",":man-biking::skin-tone-5:":"🚴🏿‍♂️",":man-biking:":"🚴‍♂️",":woman-mountain-biking::skin-tone-1:":"🚵🏻‍♀️",":woman-mountain-biking::skin-tone-2:":"🚵🏼‍♀️",":woman-mountain-biking::skin-tone-3:":"🚵🏽‍♀️",":woman-mountain-biking::skin-tone-4:":"🚵🏾‍♀️",":woman-mountain-biking::skin-tone-5:":"🚵🏿‍♀️",":woman-mountain-biking:":"🚵‍♀️",":man-mountain-biking::skin-tone-1:":"🚵🏻‍♂️",":man-mountain-biking::skin-tone-2:":"🚵🏼‍♂️",":man-mountain-biking::skin-tone-3:":"🚵🏽‍♂️",":man-mountain-biking::skin-tone-4:":"🚵🏾‍♂️",":man-mountain-biking::skin-tone-5:":"🚵🏿‍♂️",":man-mountain-biking:":"🚵‍♂️",":woman-walking::skin-tone-1:":"🚶🏻‍♀️",":woman-walking::skin-tone-2:":"🚶🏼‍♀️",":woman-walking::skin-tone-3:":"🚶🏽‍♀️",":woman-walking::skin-tone-4:":"🚶🏾‍♀️",":woman-walking::skin-tone-5:":"🚶🏿‍♀️",":woman-walking:":"🚶‍♀️",":man-walking::skin-tone-1:":"🚶🏻‍♂️",":man-walking::skin-tone-2:":"🚶🏼‍♂️",":man-walking::skin-tone-3:":"🚶🏽‍♂️",":man-walking::skin-tone-4:":"🚶🏾‍♂️",":man-walking::skin-tone-5:":"🚶🏿‍♂️",":man-walking:":"🚶‍♂️",":woman-facepalming::skin-tone-1:":"🤦🏻‍♀️",":woman-facepalming::skin-tone-2:":"🤦🏼‍♀️",":woman-facepalming::skin-tone-3:":"🤦🏽‍♀️",":woman-facepalming::skin-tone-4:":"🤦🏾‍♀️",":woman-facepalming::skin-tone-5:":"🤦🏿‍♀️",":woman-facepalming:":"🤦‍♀️",":man-facepalming::skin-tone-1:":"🤦🏻‍♂️",":man-facepalming::skin-tone-2:":"🤦🏼‍♂️",":man-facepalming::skin-tone-3:":"🤦🏽‍♂️",":man-facepalming::skin-tone-4:":"🤦🏾‍♂️",":man-facepalming::skin-tone-5:":"🤦🏿‍♂️",":man-facepalming:":"🤦‍♂️",":woman-shrugging::skin-tone-1:":"🤷🏻‍♀️",":woman-shrugging::skin-tone-2:":"🤷🏼‍♀️",":woman-shrugging::skin-tone-3:":"🤷🏽‍♀️",":woman-shrugging::skin-tone-4:":"🤷🏾‍♀️",":woman-shrugging::skin-tone-5:":"🤷🏿‍♀️",":woman-shrugging:":"🤷‍♀️",":man-shrugging::skin-tone-1:":"🤷🏻‍♂️",":man-shrugging::skin-tone-2:":"🤷🏼‍♂️",":man-shrugging::skin-tone-3:":"🤷🏽‍♂️",":man-shrugging::skin-tone-4:":"🤷🏾‍♂️",":man-shrugging::skin-tone-5:":"🤷🏿‍♂️",":man-shrugging:":"🤷‍♂️",":woman-cartwheeling::skin-tone-1:":"🤸🏻‍♀️",":woman-cartwheeling::skin-tone-2:":"🤸🏼‍♀️",":woman-cartwheeling::skin-tone-3:":"🤸🏽‍♀️",":woman-cartwheeling::skin-tone-4:":"🤸🏾‍♀️",":woman-cartwheeling::skin-tone-5:":"🤸🏿‍♀️",":woman-cartwheeling:":"🤸‍♀️",":man-cartwheeling::skin-tone-1:":"🤸🏻‍♂️",":man-cartwheeling::skin-tone-2:":"🤸🏼‍♂️",":man-cartwheeling::skin-tone-3:":"🤸🏽‍♂️",":man-cartwheeling::skin-tone-4:":"🤸🏾‍♂️",":man-cartwheeling::skin-tone-5:":"🤸🏿‍♂️",":man-cartwheeling:":"🤸‍♂️",":woman-juggling::skin-tone-1:":"🤹🏻‍♀️",":woman-juggling::skin-tone-2:":"🤹🏼‍♀️",":woman-juggling::skin-tone-3:":"🤹🏽‍♀️",":woman-juggling::skin-tone-4:":"🤹🏾‍♀️",":woman-juggling::skin-tone-5:":"🤹🏿‍♀️",":woman-juggling:":"🤹‍♀️",":man-juggling::skin-tone-1:":"🤹🏻‍♂️",":man-juggling::skin-tone-2:":"🤹🏼‍♂️",":man-juggling::skin-tone-3:":"🤹🏽‍♂️",":man-juggling::skin-tone-4:":"🤹🏾‍♂️",":man-juggling::skin-tone-5:":"🤹🏿‍♂️",":man-juggling:":"🤹‍♂️",":woman-wrestling:":"🤼‍♀️",":man-wrestling:":"🤼‍♂️",":woman-playing-water-polo::skin-tone-1:":"🤽🏻‍♀️",":woman-playing-water-polo::skin-tone-2:":"🤽🏼‍♀️",":woman-playing-water-polo::skin-tone-3:":"🤽🏽‍♀️",":woman-playing-water-polo::skin-tone-4:":"🤽🏾‍♀️",":woman-playing-water-polo::skin-tone-5:":"🤽🏿‍♀️",":woman-playing-water-polo:":"🤽‍♀️",":man-playing-water-polo::skin-tone-1:":"🤽🏻‍♂️",":man-playing-water-polo::skin-tone-2:":"🤽🏼‍♂️",":man-playing-water-polo::skin-tone-3:":"🤽🏽‍♂️",":man-playing-water-polo::skin-tone-4:":"🤽🏾‍♂️",":man-playing-water-polo::skin-tone-5:":"🤽🏿‍♂️",":man-playing-water-polo:":"🤽‍♂️",":woman-playing-handball::skin-tone-1:":"🤾🏻‍♀️",":woman-playing-handball::skin-tone-2:":"🤾🏼‍♀️",":woman-playing-handball::skin-tone-3:":"🤾🏽‍♀️",":woman-playing-handball::skin-tone-4:":"🤾🏾‍♀️",":woman-playing-handball::skin-tone-5:":"🤾🏿‍♀️",":woman-playing-handball:":"🤾‍♀️",":man-playing-handball::skin-tone-1:":"🤾🏻‍♂️",":man-playing-handball::skin-tone-2:":"🤾🏼‍♂️",":man-playing-handball::skin-tone-3:":"🤾🏽‍♂️",":man-playing-handball::skin-tone-4:":"🤾🏾‍♂️",":man-playing-handball::skin-tone-5:":"🤾🏿‍♂️",":man-playing-handball:":"🤾‍♂️",":woman-bouncing-ball::skin-tone-1:":"⛹🏻‍♀️",":woman-bouncing-ball::skin-tone-2:":"⛹🏼‍♀️",":woman-bouncing-ball::skin-tone-3:":"⛹🏽‍♀️",":woman-bouncing-ball::skin-tone-4:":"⛹🏾‍♀️",":woman-bouncing-ball::skin-tone-5:":"⛹🏿‍♀️",":woman-bouncing-ball:":"⛹️‍♀️",":man-bouncing-ball::skin-tone-1:":"⛹🏻‍♂️",":man-bouncing-ball::skin-tone-2:":"⛹🏼‍♂️",":man-bouncing-ball::skin-tone-3:":"⛹🏽‍♂️",":man-bouncing-ball::skin-tone-4:":"⛹🏾‍♂️",":man-bouncing-ball::skin-tone-5:":"⛹🏿‍♂️",":man-bouncing-ball:":"⛹️‍♂️"}
  /*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */

"use strict";

function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { start: peg$parsestart },
      peg$startRuleFunction  = peg$parsestart,

      peg$c0 = function(children) { return {type: 'markup', children: flatten(children)} },
      peg$c1 = function(children) { return {type: 'text-block', children} },
      peg$c2 = peg$anyExpectation(),
      peg$c3 = function(children) { return {type: 'text-block', children: flatten(children)} },
      peg$c4 = "`",
      peg$c5 = peg$literalExpectation("`", false),
      peg$c6 = "```",
      peg$c7 = peg$literalExpectation("```", false),
      peg$c8 = "\\",
      peg$c9 = peg$literalExpectation("\\", false),
      peg$c10 = "~",
      peg$c11 = peg$literalExpectation("~", false),
      peg$c12 = "*",
      peg$c13 = peg$literalExpectation("*", false),
      peg$c14 = "_",
      peg$c15 = peg$literalExpectation("_", false),
      peg$c16 = ":",
      peg$c17 = peg$literalExpectation(":", false),
      peg$c18 = ">",
      peg$c19 = peg$literalExpectation(">", false),
      peg$c20 = /^[()[\].,!?]/,
      peg$c21 = peg$otherExpectation("stripped character class"),
      peg$c22 = function() { return text() },
      peg$c23 = function(char) { return char },
      peg$c24 = function(children) { return {type: 'quote-block', children: flatten(children)} },
      peg$c25 = function(children) { return {type: 'bold', children: flatten(children)} },
      peg$c26 = function(children) { return {type: 'italic', children: flatten(children)} },
      peg$c27 = function(children) { return {type: 'strike', children: flatten(children)} },
      peg$c28 = function(children) { return {type: 'code-block', children: flatten(children)} },
      peg$c29 = function(children) { return {type: 'inline-code', children: flatten(children)} },
      peg$c30 = /^[a-zA-Z0-9+_\-]/,
      peg$c31 = peg$otherExpectation("stripped character class"),
      peg$c32 = "::skin-tone-",
      peg$c33 = peg$literalExpectation("::skin-tone-", false),
      peg$c34 = /^[1-6]/,
      peg$c35 = peg$otherExpectation("stripped character class"),
      peg$c36 = function(children, tone) { return {type: 'emoji', children: [text()]} },
      peg$c37 = peg$otherExpectation("unicode emoji"),
      peg$c38 = /^[\xA9\uFE0F\xAE\u203C\u2049\u2122\u2139\u2194\u2195\u2196\u2197\u2198\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9\u23EA\u23EB\u23EC\u23ED\u23EE\u23EF\u23F0\u23F1\u23F2\u23F3\u23F8\u23F9\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FD\u25FE\u2600\u2601\u2602\u2603\u2604\u260E\u2611\u2614\u2615\u2618\u261D\uD83C\uDFFB\uD83C\uDFFC\uD83C\uDFFD\uD83C\uDFFE\uD83C\uDFFF\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638\u2639\u263A\u2640\u2642\u2648\u2649\u264A\u264B\u264C\u264D\u264E\u264F\u2650\u2651\u2652\u2653\u2660\u2663\u2665\u2666\u2668\u267B\u267F\u2692\u2693\u2694\u2695\u2696\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0\u26F1\u26F2\u26F3\u26F4\u26F5\u26F7\u26F8\u26F9\u26FA\u26FD\u2702\u2705\u2708\u2709\u270A\u270B\u270C\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753\u2754\u2755\u2757\u2763\u2764\u2795\u2796\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05\u2B06\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\uD83C\uDC04\uD83C\uDCCF\uD83C\uDD70\uD83C\uDD71\uD83C\uDD7E\uD83C\uDD7F\uD83C\uDD8E\uD83C\uDD91\uD83C\uDD92\uD83C\uDD93\uD83C\uDD94\uD83C\uDD95\uD83C\uDD96\uD83C\uDD97\uD83C\uDD98\uD83C\uDD99\uD83C\uDD9A\uD83C\uDE01\uD83C\uDE02\uD83C\uDE1A\uD83C\uDE2F\uD83C\uDE32\uD83C\uDE33\uD83C\uDE34\uD83C\uDE35\uD83C\uDE36\uD83C\uDE37\uD83C\uDE38\uD83C\uDE39\uD83C\uDE3A\uD83C\uDE50\uD83C\uDE51\uD83C\uDF00\uD83C\uDF01\uD83C\uDF02\uD83C\uDF03\uD83C\uDF04\uD83C\uDF05\uD83C\uDF06\uD83C\uDF07\uD83C\uDF08\uD83C\uDF09\uD83C\uDF0A\uD83C\uDF0B\uD83C\uDF0C\uD83C\uDF0D\uD83C\uDF0E\uD83C\uDF0F\uD83C\uDF10\uD83C\uDF11\uD83C\uDF12\uD83C\uDF13\uD83C\uDF14\uD83C\uDF15\uD83C\uDF16\uD83C\uDF17\uD83C\uDF18\uD83C\uDF19\uD83C\uDF1A\uD83C\uDF1B\uD83C\uDF1C\uD83C\uDF1D\uD83C\uDF1E\uD83C\uDF1F\uD83C\uDF20\uD83C\uDF21\uD83C\uDF24\uD83C\uDF25\uD83C\uDF26\uD83C\uDF27\uD83C\uDF28\uD83C\uDF29\uD83C\uDF2A\uD83C\uDF2B\uD83C\uDF2C\uD83C\uDF2D\uD83C\uDF2E\uD83C\uDF2F\uD83C\uDF30\uD83C\uDF31\uD83C\uDF32\uD83C\uDF33\uD83C\uDF34\uD83C\uDF35\uD83C\uDF36\uD83C\uDF37\uD83C\uDF38\uD83C\uDF39\uD83C\uDF3A\uD83C\uDF3B\uD83C\uDF3C\uD83C\uDF3D\uD83C\uDF3E\uD83C\uDF3F\uD83C\uDF40\uD83C\uDF41\uD83C\uDF42\uD83C\uDF43\uD83C\uDF44\uD83C\uDF45\uD83C\uDF46\uD83C\uDF47\uD83C\uDF48\uD83C\uDF49\uD83C\uDF4A\uD83C\uDF4B\uD83C\uDF4C\uD83C\uDF4D\uD83C\uDF4E\uD83C\uDF4F\uD83C\uDF50\uD83C\uDF51\uD83C\uDF52\uD83C\uDF53\uD83C\uDF54\uD83C\uDF55\uD83C\uDF56\uD83C\uDF57\uD83C\uDF58\uD83C\uDF59\uD83C\uDF5A\uD83C\uDF5B\uD83C\uDF5C\uD83C\uDF5D\uD83C\uDF5E\uD83C\uDF5F\uD83C\uDF60\uD83C\uDF61\uD83C\uDF62\uD83C\uDF63\uD83C\uDF64\uD83C\uDF65\uD83C\uDF66\uD83C\uDF67\uD83C\uDF68\uD83C\uDF69\uD83C\uDF6A\uD83C\uDF6B\uD83C\uDF6C\uD83C\uDF6D\uD83C\uDF6E\uD83C\uDF6F\uD83C\uDF70\uD83C\uDF71\uD83C\uDF72\uD83C\uDF73\uD83C\uDF74\uD83C\uDF75\uD83C\uDF76\uD83C\uDF77\uD83C\uDF78\uD83C\uDF79\uD83C\uDF7A\uD83C\uDF7B\uD83C\uDF7C\uD83C\uDF7D\uD83C\uDF7E\uD83C\uDF7F\uD83C\uDF80\uD83C\uDF81\uD83C\uDF82\uD83C\uDF83\uD83C\uDF84\uD83C\uDF85\uD83C\uDF86\uD83C\uDF87\uD83C\uDF88\uD83C\uDF89\uD83C\uDF8A\uD83C\uDF8B\uD83C\uDF8C\uD83C\uDF8D\uD83C\uDF8E\uD83C\uDF8F\uD83C\uDF90\uD83C\uDF91\uD83C\uDF92\uD83C\uDF93\uD83C\uDF96\uD83C\uDF97\uD83C\uDF99\uD83C\uDF9A\uD83C\uDF9B\uD83C\uDF9E\uD83C\uDF9F\uD83C\uDFA0\uD83C\uDFA1\uD83C\uDFA2\uD83C\uDFA3\uD83C\uDFA4\uD83C\uDFA5\uD83C\uDFA6\uD83C\uDFA7\uD83C\uDFA8\uD83C\uDFA9\uD83C\uDFAA\uD83C\uDFAB\uD83C\uDFAC\uD83C\uDFAD\uD83C\uDFAE\uD83C\uDFAF\uD83C\uDFB0\uD83C\uDFB1\uD83C\uDFB2\uD83C\uDFB3\uD83C\uDFB4\uD83C\uDFB5\uD83C\uDFB6\uD83C\uDFB7\uD83C\uDFB8\uD83C\uDFB9\uD83C\uDFBA\uD83C\uDFBB\uD83C\uDFBC\uD83C\uDFBD\uD83C\uDFBE\uD83C\uDFBF\uD83C\uDFC0\uD83C\uDFC1\uD83C\uDFC2\uD83C\uDFC3\uD83C\uDFC4\uD83C\uDFC5\uD83C\uDFC6\uD83C\uDFC7\uD83C\uDFC8\uD83C\uDFC9\uD83C\uDFCA\uD83C\uDFCB\uD83C\uDFCC\uD83C\uDFCD\uD83C\uDFCE\uD83C\uDFCF\uD83C\uDFD0\uD83C\uDFD1\uD83C\uDFD2\uD83C\uDFD3\uD83C\uDFD4\uD83C\uDFD5\uD83C\uDFD6\uD83C\uDFD7\uD83C\uDFD8\uD83C\uDFD9\uD83C\uDFDA\uD83C\uDFDB\uD83C\uDFDC\uD83C\uDFDD\uD83C\uDFDE\uD83C\uDFDF\uD83C\uDFE0\uD83C\uDFE1\uD83C\uDFE2\uD83C\uDFE3\uD83C\uDFE4\uD83C\uDFE5\uD83C\uDFE6\uD83C\uDFE7\uD83C\uDFE8\uD83C\uDFE9\uD83C\uDFEA\uD83C\uDFEB\uD83C\uDFEC\uD83C\uDFED\uD83C\uDFEE\uD83C\uDFEF\uD83C\uDFF0\uD83C\uDFF3\uD83C\uDFF4\uD83C\uDFF5\uD83C\uDFF7\uD83C\uDFF8\uD83C\uDFF9\uD83C\uDFFA\uD83D\uDC00\uD83D\uDC01\uD83D\uDC02\uD83D\uDC03\uD83D\uDC04\uD83D\uDC05\uD83D\uDC06\uD83D\uDC07\uD83D\uDC08\uD83D\uDC09\uD83D\uDC0A\uD83D\uDC0B\uD83D\uDC0C\uD83D\uDC0D\uD83D\uDC0E\uD83D\uDC0F\uD83D\uDC10\uD83D\uDC11\uD83D\uDC12\uD83D\uDC13\uD83D\uDC14\uD83D\uDC15\uD83D\uDC16\uD83D\uDC17\uD83D\uDC18\uD83D\uDC19\uD83D\uDC1A\uD83D\uDC1B\uD83D\uDC1C\uD83D\uDC1D\uD83D\uDC1E\uD83D\uDC1F\uD83D\uDC20\uD83D\uDC21\uD83D\uDC22\uD83D\uDC23\uD83D\uDC24\uD83D\uDC25\uD83D\uDC26\uD83D\uDC27\uD83D\uDC28\uD83D\uDC29\uD83D\uDC2A\uD83D\uDC2B\uD83D\uDC2C\uD83D\uDC2D\uD83D\uDC2E\uD83D\uDC2F\uD83D\uDC30\uD83D\uDC31\uD83D\uDC32\uD83D\uDC33\uD83D\uDC34\uD83D\uDC35\uD83D\uDC36\uD83D\uDC37\uD83D\uDC38\uD83D\uDC39\uD83D\uDC3A\uD83D\uDC3B\uD83D\uDC3C\uD83D\uDC3D\uD83D\uDC3E\uD83D\uDC3F\uD83D\uDC40\uD83D\uDC41\uD83D\uDC42\uD83D\uDC43\uD83D\uDC44\uD83D\uDC45\uD83D\uDC46\uD83D\uDC47\uD83D\uDC48\uD83D\uDC49\uD83D\uDC4A\uD83D\uDC4B\uD83D\uDC4C\uD83D\uDC4D\uD83D\uDC4E\uD83D\uDC4F\uD83D\uDC50\uD83D\uDC51\uD83D\uDC52\uD83D\uDC53\uD83D\uDC54\uD83D\uDC55\uD83D\uDC56\uD83D\uDC57\uD83D\uDC58\uD83D\uDC59\uD83D\uDC5A\uD83D\uDC5B\uD83D\uDC5C\uD83D\uDC5D\uD83D\uDC5E\uD83D\uDC5F\uD83D\uDC60\uD83D\uDC61\uD83D\uDC62\uD83D\uDC63\uD83D\uDC64\uD83D\uDC65\uD83D\uDC66\uD83D\uDC67\uD83D\uDC68\uD83D\uDC69\uD83D\uDC6A\uD83D\uDC6B\uD83D\uDC6C\uD83D\uDC6D\uD83D\uDC6E\uD83D\uDC6F\uD83D\uDC70\uD83D\uDC71\uD83D\uDC72\uD83D\uDC73\uD83D\uDC74\uD83D\uDC75\uD83D\uDC76\uD83D\uDC77\uD83D\uDC78\uD83D\uDC79\uD83D\uDC7A\uD83D\uDC7B\uD83D\uDC7C\uD83D\uDC7D\uD83D\uDC7E\uD83D\uDC7F\uD83D\uDC80\uD83D\uDC81\uD83D\uDC82\uD83D\uDC83\uD83D\uDC84\uD83D\uDC85\uD83D\uDC86\uD83D\uDC87\uD83D\uDC88\uD83D\uDC89\uD83D\uDC8A\uD83D\uDC8B\uD83D\uDC8C\uD83D\uDC8D\uD83D\uDC8E\uD83D\uDC8F\uD83D\uDC90\uD83D\uDC91\uD83D\uDC92\uD83D\uDC93\uD83D\uDC94\uD83D\uDC95\uD83D\uDC96\uD83D\uDC97\uD83D\uDC98\uD83D\uDC99\uD83D\uDC9A\uD83D\uDC9B\uD83D\uDC9C\uD83D\uDC9D\uD83D\uDC9E\uD83D\uDC9F\uD83D\uDCA0\uD83D\uDCA1\uD83D\uDCA2\uD83D\uDCA3\uD83D\uDCA4\uD83D\uDCA5\uD83D\uDCA6\uD83D\uDCA7\uD83D\uDCA8\uD83D\uDCA9\uD83D\uDCAA\uD83D\uDCAB\uD83D\uDCAC\uD83D\uDCAD\uD83D\uDCAE\uD83D\uDCAF\uD83D\uDCB0\uD83D\uDCB1\uD83D\uDCB2\uD83D\uDCB3\uD83D\uDCB4\uD83D\uDCB5\uD83D\uDCB6\uD83D\uDCB7\uD83D\uDCB8\uD83D\uDCB9\uD83D\uDCBA\uD83D\uDCBB\uD83D\uDCBC\uD83D\uDCBD\uD83D\uDCBE\uD83D\uDCBF\uD83D\uDCC0\uD83D\uDCC1\uD83D\uDCC2\uD83D\uDCC3\uD83D\uDCC4\uD83D\uDCC5\uD83D\uDCC6\uD83D\uDCC7\uD83D\uDCC8\uD83D\uDCC9\uD83D\uDCCA\uD83D\uDCCB\uD83D\uDCCC\uD83D\uDCCD\uD83D\uDCCE\uD83D\uDCCF\uD83D\uDCD0\uD83D\uDCD1\uD83D\uDCD2\uD83D\uDCD3\uD83D\uDCD4\uD83D\uDCD5\uD83D\uDCD6\uD83D\uDCD7\uD83D\uDCD8\uD83D\uDCD9\uD83D\uDCDA\uD83D\uDCDB\uD83D\uDCDC\uD83D\uDCDD\uD83D\uDCDE\uD83D\uDCDF\uD83D\uDCE0\uD83D\uDCE1\uD83D\uDCE2\uD83D\uDCE3\uD83D\uDCE4\uD83D\uDCE5\uD83D\uDCE6\uD83D\uDCE7\uD83D\uDCE8\uD83D\uDCE9\uD83D\uDCEA\uD83D\uDCEB\uD83D\uDCEC\uD83D\uDCED\uD83D\uDCEE\uD83D\uDCEF\uD83D\uDCF0\uD83D\uDCF1\uD83D\uDCF2\uD83D\uDCF3\uD83D\uDCF4\uD83D\uDCF5\uD83D\uDCF6\uD83D\uDCF7\uD83D\uDCF8\uD83D\uDCF9\uD83D\uDCFA\uD83D\uDCFB\uD83D\uDCFC\uD83D\uDCFD\uD83D\uDCFF\uD83D\uDD00\uD83D\uDD01\uD83D\uDD02\uD83D\uDD03\uD83D\uDD04\uD83D\uDD05\uD83D\uDD06\uD83D\uDD07\uD83D\uDD08\uD83D\uDD09\uD83D\uDD0A\uD83D\uDD0B\uD83D\uDD0C\uD83D\uDD0D\uD83D\uDD0E\uD83D\uDD0F\uD83D\uDD10\uD83D\uDD11\uD83D\uDD12\uD83D\uDD13\uD83D\uDD14\uD83D\uDD15\uD83D\uDD16\uD83D\uDD17\uD83D\uDD18\uD83D\uDD19\uD83D\uDD1A\uD83D\uDD1B\uD83D\uDD1C\uD83D\uDD1D\uD83D\uDD1E\uD83D\uDD1F\uD83D\uDD20\uD83D\uDD21\uD83D\uDD22\uD83D\uDD23\uD83D\uDD24\uD83D\uDD25\uD83D\uDD26\uD83D\uDD27\uD83D\uDD28\uD83D\uDD29\uD83D\uDD2A\uD83D\uDD2B\uD83D\uDD2C\uD83D\uDD2D\uD83D\uDD2E\uD83D\uDD2F\uD83D\uDD30\uD83D\uDD31\uD83D\uDD32\uD83D\uDD33\uD83D\uDD34\uD83D\uDD35\uD83D\uDD36\uD83D\uDD37\uD83D\uDD38\uD83D\uDD39\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3C\uD83D\uDD3D\uD83D\uDD49\uD83D\uDD4A\uD83D\uDD4B\uD83D\uDD4C\uD83D\uDD4D\uD83D\uDD4E\uD83D\uDD50\uD83D\uDD51\uD83D\uDD52\uD83D\uDD53\uD83D\uDD54\uD83D\uDD55\uD83D\uDD56\uD83D\uDD57\uD83D\uDD58\uD83D\uDD59\uD83D\uDD5A\uD83D\uDD5B\uD83D\uDD5C\uD83D\uDD5D\uD83D\uDD5E\uD83D\uDD5F\uD83D\uDD60\uD83D\uDD61\uD83D\uDD62\uD83D\uDD63\uD83D\uDD64\uD83D\uDD65\uD83D\uDD66\uD83D\uDD67\uD83D\uDD6F\uD83D\uDD70\uD83D\uDD73\uD83D\uDD74\uD83D\uDD75\uD83D\uDD76\uD83D\uDD77\uD83D\uDD78\uD83D\uDD79\uD83D\uDD7A\uD83D\uDD87\uD83D\uDD8A\uD83D\uDD8B\uD83D\uDD8C\uD83D\uDD8D\uD83D\uDD90\uD83D\uDD95\uD83D\uDD96\uD83D\uDDA4\uD83D\uDDA5\uD83D\uDDA8\uD83D\uDDB1\uD83D\uDDB2\uD83D\uDDBC\uD83D\uDDC2\uD83D\uDDC3\uD83D\uDDC4\uD83D\uDDD1\uD83D\uDDD2\uD83D\uDDD3\uD83D\uDDDC\uD83D\uDDDD\uD83D\uDDDE\uD83D\uDDE1\uD83D\uDDE3\uD83D\uDDE8\uD83D\uDDEF\uD83D\uDDF3\uD83D\uDDFA\uD83D\uDDFB\uD83D\uDDFC\uD83D\uDDFD\uD83D\uDDFE\uD83D\uDDFF\uD83D\uDE00\uD83D\uDE01\uD83D\uDE02\uD83D\uDE03\uD83D\uDE04\uD83D\uDE05\uD83D\uDE06\uD83D\uDE07\uD83D\uDE08\uD83D\uDE09\uD83D\uDE0A\uD83D\uDE0B\uD83D\uDE0C\uD83D\uDE0D\uD83D\uDE0E\uD83D\uDE0F\uD83D\uDE10\uD83D\uDE11\uD83D\uDE12\uD83D\uDE13\uD83D\uDE14\uD83D\uDE15\uD83D\uDE16\uD83D\uDE17\uD83D\uDE18\uD83D\uDE19\uD83D\uDE1A\uD83D\uDE1B\uD83D\uDE1C\uD83D\uDE1D\uD83D\uDE1E\uD83D\uDE1F\uD83D\uDE20\uD83D\uDE21\uD83D\uDE22\uD83D\uDE23\uD83D\uDE24\uD83D\uDE25\uD83D\uDE26\uD83D\uDE27\uD83D\uDE28\uD83D\uDE29\uD83D\uDE2A\uD83D\uDE2B\uD83D\uDE2C\uD83D\uDE2D\uD83D\uDE2E\uD83D\uDE2F\uD83D\uDE30\uD83D\uDE31\uD83D\uDE32\uD83D\uDE33\uD83D\uDE34\uD83D\uDE35\uD83D\uDE36\uD83D\uDE37\uD83D\uDE38\uD83D\uDE39\uD83D\uDE3A\uD83D\uDE3B\uD83D\uDE3C\uD83D\uDE3D\uD83D\uDE3E\uD83D\uDE3F\uD83D\uDE40\uD83D\uDE41\uD83D\uDE42\uD83D\uDE43\uD83D\uDE44\uD83D\uDE45\uD83D\uDE46\uD83D\uDE47\uD83D\uDE48\uD83D\uDE49\uD83D\uDE4A\uD83D\uDE4B\uD83D\uDE4C\uD83D\uDE4D\uD83D\uDE4E\uD83D\uDE4F\uD83D\uDE80\uD83D\uDE81\uD83D\uDE82\uD83D\uDE83\uD83D\uDE84\uD83D\uDE85\uD83D\uDE86\uD83D\uDE87\uD83D\uDE88\uD83D\uDE89\uD83D\uDE8A\uD83D\uDE8B\uD83D\uDE8C\uD83D\uDE8D\uD83D\uDE8E\uD83D\uDE8F\uD83D\uDE90\uD83D\uDE91\uD83D\uDE92\uD83D\uDE93\uD83D\uDE94\uD83D\uDE95\uD83D\uDE96\uD83D\uDE97\uD83D\uDE98\uD83D\uDE99\uD83D\uDE9A\uD83D\uDE9B\uD83D\uDE9C\uD83D\uDE9D\uD83D\uDE9E\uD83D\uDE9F\uD83D\uDEA0\uD83D\uDEA1\uD83D\uDEA2\uD83D\uDEA3\uD83D\uDEA4\uD83D\uDEA5\uD83D\uDEA6\uD83D\uDEA7\uD83D\uDEA8\uD83D\uDEA9\uD83D\uDEAA\uD83D\uDEAB\uD83D\uDEAC\uD83D\uDEAD\uD83D\uDEAE\uD83D\uDEAF\uD83D\uDEB0\uD83D\uDEB1\uD83D\uDEB2\uD83D\uDEB3\uD83D\uDEB4\uD83D\uDEB5\uD83D\uDEB6\uD83D\uDEB7\uD83D\uDEB8\uD83D\uDEB9\uD83D\uDEBA\uD83D\uDEBB\uD83D\uDEBC\uD83D\uDEBD\uD83D\uDEBE\uD83D\uDEBF\uD83D\uDEC0\uD83D\uDEC1\uD83D\uDEC2\uD83D\uDEC3\uD83D\uDEC4\uD83D\uDEC5\uD83D\uDECB\uD83D\uDECC\uD83D\uDECD\uD83D\uDECE\uD83D\uDECF\uD83D\uDED0\uD83D\uDED1\uD83D\uDED2\uD83D\uDEE0\uD83D\uDEE1\uD83D\uDEE2\uD83D\uDEE3\uD83D\uDEE4\uD83D\uDEE5\uD83D\uDEE9\uD83D\uDEEB\uD83D\uDEEC\uD83D\uDEF0\uD83D\uDEF3\uD83D\uDEF4\uD83D\uDEF5\uD83D\uDEF6\uD83E\uDD10\uD83E\uDD11\uD83E\uDD12\uD83E\uDD13\uD83E\uDD14\uD83E\uDD15\uD83E\uDD16\uD83E\uDD17\uD83E\uDD18\uD83E\uDD19\uD83E\uDD1A\uD83E\uDD1B\uD83E\uDD1C\uD83E\uDD1D\uD83E\uDD1E\uD83E\uDD20\uD83E\uDD21\uD83E\uDD22\uD83E\uDD23\uD83E\uDD24\uD83E\uDD25\uD83E\uDD26\uD83E\uDD27\uD83E\uDD30\uD83E\uDD33\uD83E\uDD34\uD83E\uDD35\uD83E\uDD36\uD83E\uDD37\uD83E\uDD38\uD83E\uDD39\uD83E\uDD3A\uD83E\uDD3C\uD83E\uDD3D\uD83E\uDD3E\uD83E\uDD40\uD83E\uDD41\uD83E\uDD42\uD83E\uDD43\uD83E\uDD44\uD83E\uDD45\uD83E\uDD47\uD83E\uDD48\uD83E\uDD49\uD83E\uDD4A\uD83E\uDD4B\uD83E\uDD50\uD83E\uDD51\uD83E\uDD52\uD83E\uDD53\uD83E\uDD54\uD83E\uDD55\uD83E\uDD56\uD83E\uDD57\uD83E\uDD58\uD83E\uDD59\uD83E\uDD5A\uD83E\uDD5B\uD83E\uDD5C\uD83E\uDD5D\uD83E\uDD5E\uD83E\uDD80\uD83E\uDD81\uD83E\uDD82\uD83E\uDD83\uD83E\uDD84\uD83E\uDD85\uD83E\uDD86\uD83E\uDD87\uD83E\uDD88\uD83E\uDD89\uD83E\uDD8A\uD83E\uDD8B\uD83E\uDD8C\uD83E\uDD8D\uD83E\uDD8E\uD83E\uDD8F\uD83E\uDD90\uD83E\uDD91\uD83E\uDDC0#\u20E3*0123456789\uD83C\uDDE6\uD83C\uDDE8\uD83C\uDDE9\uD83C\uDDEA\uD83C\uDDEB\uD83C\uDDEC\uD83C\uDDEE\uD83C\uDDF1\uD83C\uDDF2\uD83C\uDDF4\uD83C\uDDF6\uD83C\uDDF7\uD83C\uDDF8\uD83C\uDDF9\uD83C\uDDFA\uD83C\uDDFC\uD83C\uDDFD\uD83C\uDDFF\uD83C\uDDE7\uD83C\uDDED\uD83C\uDDEF\uD83C\uDDF3\uD83C\uDDFB\uD83C\uDDFE\uD83C\uDDF0\uD83C\uDDF5\u200D]/,
      peg$c39 = peg$otherExpectation("stripped character class"),
      peg$c40 = function(emoji) {
         const emojiText = emoji.join('')
         const results = []
         let match
         let idx = 0
         while ((match = emojiExp.exec(emojiText)) !== null) {
           results.push(emojiText.substring(idx, match.index))
           results.push({type: 'native-emoji', children: [emojiIndexByChar[match[0]]]})
           idx = match.index + match[0].length
         }
         results.push(emojiText.substring(idx, emojiText.length))
         return results.filter(Boolean)
       },
      peg$c41 = "http",
      peg$c42 = peg$literalExpectation("http", true),
      peg$c43 = "s",
      peg$c44 = peg$literalExpectation("s", true),
      peg$c45 = function(proto, url) {
           const matches = url.join('').match(linkExp)
           if (!matches) {
             return false
           }
           const match = matches[0]
           url._match = match  // save the match via expando property (used below)
           return goodLink(match)
         },
      peg$c46 = function(proto, url) {
         const match = url._match
         delete url._match
         const urlText = url.join('')
         const protoText = proto ? proto.join('') : ''
         const href = (protoText || 'http://') + match
         const text = protoText + match
         return [
           {type: 'link', href, children: [text]},
           urlText.substring(match.length, urlText.length),
         ]
       },
      peg$c47 = /^[\t\x0B\f \xA0\uFEFF]/,
      peg$c48 = peg$otherExpectation("stripped character class"),
      peg$c49 = peg$otherExpectation("end of line"),
      peg$c50 = "\n",
      peg$c51 = peg$literalExpectation("\n", false),
      peg$c52 = "\r\n",
      peg$c53 = peg$literalExpectation("\r\n", false),
      peg$c54 = "\r",
      peg$c55 = peg$literalExpectation("\r", false),
      peg$c56 = "\u2028",
      peg$c57 = peg$literalExpectation("\u2028", false),
      peg$c58 = "\u2029",
      peg$c59 = peg$literalExpectation("\u2029", false),
      peg$c60 = function() { /* consume */ },
      peg$c61 = /^[ \xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/,
      peg$c62 = peg$otherExpectation("stripped character class"),

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parsestart() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseBlankLine();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseBlankLine();
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseWhiteSpace();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseWhiteSpace();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$currPos;
        s6 = peg$parseLine();
        if (s6 !== peg$FAILED) {
          s7 = peg$parseLineTerminatorSequence();
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 === peg$FAILED) {
          s5 = peg$parseNonEndBlankLine();
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$currPos;
          s6 = peg$parseLine();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseLineTerminatorSequence();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = peg$parseNonEndBlankLine();
          }
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseLine();
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$parseBlankLine();
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseBlankLine();
          }
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parseWhiteSpace();
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$parseWhiteSpace();
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c0(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseLine() {
    var s0, s1;

    s0 = [];
    s1 = peg$parseQuoteBlock();
    if (s1 === peg$FAILED) {
      s1 = peg$parseCodeBlock();
      if (s1 === peg$FAILED) {
        s1 = peg$parseTextBlock();
      }
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parseQuoteBlock();
        if (s1 === peg$FAILED) {
          s1 = peg$parseCodeBlock();
          if (s1 === peg$FAILED) {
            s1 = peg$parseTextBlock();
          }
        }
      }
    } else {
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseBlankLine() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseWhiteSpace();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseWhiteSpace();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseLineTerminatorSequence();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNonEndBlankLine() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseBlankLine();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$currPos;
      s4 = [];
      s5 = peg$parseBlankLine();
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = peg$parseBlankLine();
      }
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = peg$parseWhiteSpace();
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = peg$parseWhiteSpace();
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$currPos;
          peg$silentFails++;
          if (input.length > peg$currPos) {
            s7 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c2); }
          }
          peg$silentFails--;
          if (s7 === peg$FAILED) {
            s6 = void 0;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
          if (s6 !== peg$FAILED) {
            s4 = [s4, s5, s6];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseTextBlock() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    s3 = [];
    s4 = peg$parseInlineDelimiter();
    while (s4 !== peg$FAILED) {
      s3.push(s4);
      s4 = peg$parseInlineDelimiter();
    }
    if (s3 !== peg$FAILED) {
      s4 = peg$parseInlineStart();
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = peg$currPos;
        s7 = [];
        s8 = peg$parseInlineDelimiter();
        if (s8 !== peg$FAILED) {
          while (s8 !== peg$FAILED) {
            s7.push(s8);
            s8 = peg$parseInlineDelimiter();
          }
        } else {
          s7 = peg$FAILED;
        }
        if (s7 !== peg$FAILED) {
          s8 = peg$parseInlineStart();
          if (s8 !== peg$FAILED) {
            s7 = [s7, s8];
            s6 = s7;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
        } else {
          peg$currPos = s6;
          s6 = peg$FAILED;
        }
        if (s6 === peg$FAILED) {
          s6 = peg$parseInlineCont();
        }
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = peg$currPos;
          s7 = [];
          s8 = peg$parseInlineDelimiter();
          if (s8 !== peg$FAILED) {
            while (s8 !== peg$FAILED) {
              s7.push(s8);
              s8 = peg$parseInlineDelimiter();
            }
          } else {
            s7 = peg$FAILED;
          }
          if (s7 !== peg$FAILED) {
            s8 = peg$parseInlineStart();
            if (s8 !== peg$FAILED) {
              s7 = [s7, s8];
              s6 = s7;
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
          if (s6 === peg$FAILED) {
            s6 = peg$parseInlineCont();
          }
        }
        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 === peg$FAILED) {
      s2 = peg$parseInlineDelimiter();
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$currPos;
        s3 = [];
        s4 = peg$parseInlineDelimiter();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parseInlineDelimiter();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseInlineStart();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$currPos;
            s7 = [];
            s8 = peg$parseInlineDelimiter();
            if (s8 !== peg$FAILED) {
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                s8 = peg$parseInlineDelimiter();
              }
            } else {
              s7 = peg$FAILED;
            }
            if (s7 !== peg$FAILED) {
              s8 = peg$parseInlineStart();
              if (s8 !== peg$FAILED) {
                s7 = [s7, s8];
                s6 = s7;
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 === peg$FAILED) {
              s6 = peg$parseInlineCont();
            }
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$currPos;
              s7 = [];
              s8 = peg$parseInlineDelimiter();
              if (s8 !== peg$FAILED) {
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  s8 = peg$parseInlineDelimiter();
                }
              } else {
                s7 = peg$FAILED;
              }
              if (s7 !== peg$FAILED) {
                s8 = peg$parseInlineStart();
                if (s8 !== peg$FAILED) {
                  s7 = [s7, s8];
                  s6 = s7;
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
              if (s6 === peg$FAILED) {
                s6 = peg$parseInlineCont();
              }
            }
            if (s5 !== peg$FAILED) {
              s3 = [s3, s4, s5];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$parseInlineDelimiter();
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c3(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parseInlineStart() {
    var s0;

    s0 = peg$parseInlineCode();
    if (s0 === peg$FAILED) {
      s0 = peg$parseItalic();
      if (s0 === peg$FAILED) {
        s0 = peg$parseBold();
        if (s0 === peg$FAILED) {
          s0 = peg$parseStrike();
          if (s0 === peg$FAILED) {
            s0 = peg$parseLink();
            if (s0 === peg$FAILED) {
              s0 = peg$parseInlineCont();
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseInlineCont() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseCodeBlock();
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseText();
      if (s2 === peg$FAILED) {
        s2 = peg$parseEmoji();
        if (s2 === peg$FAILED) {
          s2 = peg$parseEscapedChar();
          if (s2 === peg$FAILED) {
            s2 = peg$parseNativeEmoji();
            if (s2 === peg$FAILED) {
              s2 = peg$parseSpecialChar();
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInlineDelimiter() {
    var s0;

    s0 = peg$parseWhiteSpace();
    if (s0 === peg$FAILED) {
      s0 = peg$parsePunctuationMarker();
    }

    return s0;
  }

  function peg$parseTicks1() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 96) {
      s0 = peg$c4;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c5); }
    }

    return s0;
  }

  function peg$parseTicks3() {
    var s0;

    if (input.substr(peg$currPos, 3) === peg$c6) {
      s0 = peg$c6;
      peg$currPos += 3;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c7); }
    }

    return s0;
  }

  function peg$parseEscapeMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 92) {
      s0 = peg$c8;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c9); }
    }

    return s0;
  }

  function peg$parseStrikeMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 126) {
      s0 = peg$c10;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c11); }
    }

    return s0;
  }

  function peg$parseBoldMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 42) {
      s0 = peg$c12;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c13); }
    }

    return s0;
  }

  function peg$parseItalicMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 95) {
      s0 = peg$c14;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c15); }
    }

    return s0;
  }

  function peg$parseEmojiMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 58) {
      s0 = peg$c16;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c17); }
    }

    return s0;
  }

  function peg$parseQuoteBlockMarker() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 62) {
      s0 = peg$c18;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c19); }
    }

    return s0;
  }

  function peg$parsePunctuationMarker() {
    var s0;

    if (peg$c20.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c21); }
    }

    return s0;
  }

  function peg$parseSpecialChar() {
    var s0, s1;

    s0 = peg$parseEscapeMarker();
    if (s0 === peg$FAILED) {
      s0 = peg$parseStrikeMarker();
      if (s0 === peg$FAILED) {
        s0 = peg$parseBoldMarker();
        if (s0 === peg$FAILED) {
          s0 = peg$parseItalicMarker();
          if (s0 === peg$FAILED) {
            s0 = peg$parseEmojiMarker();
            if (s0 === peg$FAILED) {
              s0 = peg$parseQuoteBlockMarker();
              if (s0 === peg$FAILED) {
                s0 = peg$parseTicks1();
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsePunctuationMarker();
                  if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c22();
                  }
                  s0 = s1;
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseEscapedChar() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseEscapeMarker();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseSpecialChar();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c23(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNormalChar() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseNativeEmojiCharacter();
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseSpecialChar();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseNonBlank();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c22();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseText() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseNormalChar();
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parseNormalChar();
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c22();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseQuoteBlock() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseQuoteBlockMarker();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseWhiteSpace();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseWhiteSpace();
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseCodeBlock();
        if (s4 === peg$FAILED) {
          s4 = peg$parseTextBlock();
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseCodeBlock();
            if (s4 === peg$FAILED) {
              s4 = peg$parseTextBlock();
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseLineTerminatorSequence();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c24(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseBold() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

    s0 = peg$currPos;
    s1 = peg$parseBoldMarker();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseWhiteSpace();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseBoldMarker();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = peg$parseInlineDelimiter();
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = peg$parseInlineDelimiter();
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parseInlineStart();
            if (s6 !== peg$FAILED) {
              s7 = [];
              s8 = peg$currPos;
              s9 = [];
              s10 = peg$parseInlineDelimiter();
              if (s10 !== peg$FAILED) {
                while (s10 !== peg$FAILED) {
                  s9.push(s10);
                  s10 = peg$parseInlineDelimiter();
                }
              } else {
                s9 = peg$FAILED;
              }
              if (s9 !== peg$FAILED) {
                s10 = peg$currPos;
                peg$silentFails++;
                s11 = peg$parseBoldMarker();
                peg$silentFails--;
                if (s11 === peg$FAILED) {
                  s10 = void 0;
                } else {
                  peg$currPos = s10;
                  s10 = peg$FAILED;
                }
                if (s10 !== peg$FAILED) {
                  s11 = peg$parseInlineStart();
                  if (s11 !== peg$FAILED) {
                    s9 = [s9, s10, s11];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
              if (s8 === peg$FAILED) {
                s8 = peg$currPos;
                s9 = peg$currPos;
                peg$silentFails++;
                s10 = peg$parseBoldMarker();
                peg$silentFails--;
                if (s10 === peg$FAILED) {
                  s9 = void 0;
                } else {
                  peg$currPos = s9;
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$parseInlineCont();
                  if (s10 !== peg$FAILED) {
                    s9 = [s9, s10];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              }
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                s8 = peg$currPos;
                s9 = [];
                s10 = peg$parseInlineDelimiter();
                if (s10 !== peg$FAILED) {
                  while (s10 !== peg$FAILED) {
                    s9.push(s10);
                    s10 = peg$parseInlineDelimiter();
                  }
                } else {
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$currPos;
                  peg$silentFails++;
                  s11 = peg$parseBoldMarker();
                  peg$silentFails--;
                  if (s11 === peg$FAILED) {
                    s10 = void 0;
                  } else {
                    peg$currPos = s10;
                    s10 = peg$FAILED;
                  }
                  if (s10 !== peg$FAILED) {
                    s11 = peg$parseInlineStart();
                    if (s11 !== peg$FAILED) {
                      s9 = [s9, s10, s11];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
                if (s8 === peg$FAILED) {
                  s8 = peg$currPos;
                  s9 = peg$currPos;
                  peg$silentFails++;
                  s10 = peg$parseBoldMarker();
                  peg$silentFails--;
                  if (s10 === peg$FAILED) {
                    s9 = void 0;
                  } else {
                    peg$currPos = s9;
                    s9 = peg$FAILED;
                  }
                  if (s9 !== peg$FAILED) {
                    s10 = peg$parseInlineCont();
                    if (s10 !== peg$FAILED) {
                      s9 = [s9, s10];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                }
              }
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseBoldMarker();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseBoldMarker();
            if (s6 === peg$FAILED) {
              s6 = peg$parseNormalChar();
            }
            peg$silentFails--;
            if (s6 === peg$FAILED) {
              s5 = void 0;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c25(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseItalic() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

    s0 = peg$currPos;
    s1 = peg$parseItalicMarker();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseWhiteSpace();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseItalicMarker();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = peg$parseInlineDelimiter();
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = peg$parseInlineDelimiter();
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parseInlineStart();
            if (s6 !== peg$FAILED) {
              s7 = [];
              s8 = peg$currPos;
              s9 = [];
              s10 = peg$parseInlineDelimiter();
              if (s10 !== peg$FAILED) {
                while (s10 !== peg$FAILED) {
                  s9.push(s10);
                  s10 = peg$parseInlineDelimiter();
                }
              } else {
                s9 = peg$FAILED;
              }
              if (s9 !== peg$FAILED) {
                s10 = peg$currPos;
                peg$silentFails++;
                s11 = peg$parseItalicMarker();
                peg$silentFails--;
                if (s11 === peg$FAILED) {
                  s10 = void 0;
                } else {
                  peg$currPos = s10;
                  s10 = peg$FAILED;
                }
                if (s10 !== peg$FAILED) {
                  s11 = peg$parseInlineStart();
                  if (s11 !== peg$FAILED) {
                    s9 = [s9, s10, s11];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
              if (s8 === peg$FAILED) {
                s8 = peg$currPos;
                s9 = peg$currPos;
                peg$silentFails++;
                s10 = peg$parseItalicMarker();
                peg$silentFails--;
                if (s10 === peg$FAILED) {
                  s9 = void 0;
                } else {
                  peg$currPos = s9;
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$parseInlineCont();
                  if (s10 !== peg$FAILED) {
                    s9 = [s9, s10];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              }
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                s8 = peg$currPos;
                s9 = [];
                s10 = peg$parseInlineDelimiter();
                if (s10 !== peg$FAILED) {
                  while (s10 !== peg$FAILED) {
                    s9.push(s10);
                    s10 = peg$parseInlineDelimiter();
                  }
                } else {
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$currPos;
                  peg$silentFails++;
                  s11 = peg$parseItalicMarker();
                  peg$silentFails--;
                  if (s11 === peg$FAILED) {
                    s10 = void 0;
                  } else {
                    peg$currPos = s10;
                    s10 = peg$FAILED;
                  }
                  if (s10 !== peg$FAILED) {
                    s11 = peg$parseInlineStart();
                    if (s11 !== peg$FAILED) {
                      s9 = [s9, s10, s11];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
                if (s8 === peg$FAILED) {
                  s8 = peg$currPos;
                  s9 = peg$currPos;
                  peg$silentFails++;
                  s10 = peg$parseItalicMarker();
                  peg$silentFails--;
                  if (s10 === peg$FAILED) {
                    s9 = void 0;
                  } else {
                    peg$currPos = s9;
                    s9 = peg$FAILED;
                  }
                  if (s9 !== peg$FAILED) {
                    s10 = peg$parseInlineCont();
                    if (s10 !== peg$FAILED) {
                      s9 = [s9, s10];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                }
              }
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseItalicMarker();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseItalicMarker();
            if (s6 === peg$FAILED) {
              s6 = peg$parseNormalChar();
            }
            peg$silentFails--;
            if (s6 === peg$FAILED) {
              s5 = void 0;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c26(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseStrike() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

    s0 = peg$currPos;
    s1 = peg$parseStrikeMarker();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseWhiteSpace();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseStrikeMarker();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = peg$parseInlineDelimiter();
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = peg$parseInlineDelimiter();
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parseInlineStart();
            if (s6 !== peg$FAILED) {
              s7 = [];
              s8 = peg$currPos;
              s9 = [];
              s10 = peg$parseInlineDelimiter();
              if (s10 !== peg$FAILED) {
                while (s10 !== peg$FAILED) {
                  s9.push(s10);
                  s10 = peg$parseInlineDelimiter();
                }
              } else {
                s9 = peg$FAILED;
              }
              if (s9 !== peg$FAILED) {
                s10 = peg$currPos;
                peg$silentFails++;
                s11 = peg$parseStrikeMarker();
                peg$silentFails--;
                if (s11 === peg$FAILED) {
                  s10 = void 0;
                } else {
                  peg$currPos = s10;
                  s10 = peg$FAILED;
                }
                if (s10 !== peg$FAILED) {
                  s11 = peg$parseInlineStart();
                  if (s11 !== peg$FAILED) {
                    s9 = [s9, s10, s11];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
              if (s8 === peg$FAILED) {
                s8 = peg$currPos;
                s9 = peg$currPos;
                peg$silentFails++;
                s10 = peg$parseStrikeMarker();
                peg$silentFails--;
                if (s10 === peg$FAILED) {
                  s9 = void 0;
                } else {
                  peg$currPos = s9;
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$parseInlineCont();
                  if (s10 !== peg$FAILED) {
                    s9 = [s9, s10];
                    s8 = s9;
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
              }
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                s8 = peg$currPos;
                s9 = [];
                s10 = peg$parseInlineDelimiter();
                if (s10 !== peg$FAILED) {
                  while (s10 !== peg$FAILED) {
                    s9.push(s10);
                    s10 = peg$parseInlineDelimiter();
                  }
                } else {
                  s9 = peg$FAILED;
                }
                if (s9 !== peg$FAILED) {
                  s10 = peg$currPos;
                  peg$silentFails++;
                  s11 = peg$parseStrikeMarker();
                  peg$silentFails--;
                  if (s11 === peg$FAILED) {
                    s10 = void 0;
                  } else {
                    peg$currPos = s10;
                    s10 = peg$FAILED;
                  }
                  if (s10 !== peg$FAILED) {
                    s11 = peg$parseInlineStart();
                    if (s11 !== peg$FAILED) {
                      s9 = [s9, s10, s11];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
                if (s8 === peg$FAILED) {
                  s8 = peg$currPos;
                  s9 = peg$currPos;
                  peg$silentFails++;
                  s10 = peg$parseStrikeMarker();
                  peg$silentFails--;
                  if (s10 === peg$FAILED) {
                    s9 = void 0;
                  } else {
                    peg$currPos = s9;
                    s9 = peg$FAILED;
                  }
                  if (s9 !== peg$FAILED) {
                    s10 = peg$parseInlineCont();
                    if (s10 !== peg$FAILED) {
                      s9 = [s9, s10];
                      s8 = s9;
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s8;
                    s8 = peg$FAILED;
                  }
                }
              }
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseStrikeMarker();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseStrikeMarker();
            if (s6 === peg$FAILED) {
              s6 = peg$parseNormalChar();
            }
            peg$silentFails--;
            if (s6 === peg$FAILED) {
              s5 = void 0;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c27(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseCodeBlock() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parseTicks3();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseLineTerminatorSequence();
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        s5 = peg$currPos;
        peg$silentFails++;
        s6 = peg$parseTicks3();
        peg$silentFails--;
        if (s6 === peg$FAILED) {
          s5 = void 0;
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c2); }
          }
          if (s6 !== peg$FAILED) {
            s5 = [s5, s6];
            s4 = s5;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$currPos;
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseTicks3();
            peg$silentFails--;
            if (s6 === peg$FAILED) {
              s5 = void 0;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              if (input.length > peg$currPos) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c2); }
              }
              if (s6 !== peg$FAILED) {
                s5 = [s5, s6];
                s4 = s5;
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseTicks3();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c28(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInlineCode() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseTicks1();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      s5 = peg$parseTicks1();
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c2); }
        }
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$currPos;
          peg$silentFails++;
          s5 = peg$parseTicks1();
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = void 0;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c2); }
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseTicks1();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c29(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInsideEmojiMarker() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseEmojiMarker();
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      if (peg$c30.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c31); }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c22();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInsideEmojiTone() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 12) === peg$c32) {
      s1 = peg$c32;
      peg$currPos += 12;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c33); }
    }
    if (s1 !== peg$FAILED) {
      if (peg$c34.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c35); }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c22();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseEmoji() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseEmojiMarker();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseInsideEmojiMarker();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseInsideEmojiMarker();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseInsideEmojiTone();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseEmojiMarker();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c36(s2, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNativeEmojiCharacter() {
    var s0, s1;

    peg$silentFails++;
    if (peg$c38.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c39); }
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c37); }
    }

    return s0;
  }

  function peg$parseNativeEmoji() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseNativeEmojiCharacter();
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parseNativeEmojiCharacter();
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c40(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parseLinkChar() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$currPos;
    s3 = [];
    s4 = peg$parseSpecialChar();
    if (s4 !== peg$FAILED) {
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = peg$parseSpecialChar();
      }
    } else {
      s3 = peg$FAILED;
    }
    if (s3 !== peg$FAILED) {
      s4 = peg$parseInlineDelimiter();
      if (s4 === peg$FAILED) {
        s4 = peg$parseLineTerminatorSequence();
        if (s4 === peg$FAILED) {
          s4 = peg$currPos;
          peg$silentFails++;
          if (input.length > peg$currPos) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c2); }
          }
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = void 0;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        }
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseNonBlank();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c23(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseLink() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c41) {
      s2 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c42); }
    }
    if (s2 !== peg$FAILED) {
      if (input.substr(peg$currPos, 1).toLowerCase() === peg$c43) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c44); }
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      if (s3 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 58) {
          s4 = peg$c16;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c17); }
        }
        if (s4 !== peg$FAILED) {
          s2 = [s2, s3, s4];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseLinkChar();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseLinkChar();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = peg$currPos;
        s3 = peg$c45(s1, s2);
        if (s3) {
          s3 = void 0;
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c46(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNonBlank() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseWhiteSpace();
    if (s2 === peg$FAILED) {
      s2 = peg$parseLineTerminatorSequence();
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      if (input.length > peg$currPos) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c2); }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c23(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseWhiteSpace() {
    var s0;

    if (peg$c47.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c48); }
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseSpace();
    }

    return s0;
  }

  function peg$parseLineTerminatorSequence() {
    var s0, s1;

    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 10) {
      s1 = peg$c50;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c51); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c52) {
        s1 = peg$c52;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c53); }
      }
      if (s1 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 13) {
          s1 = peg$c54;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c55); }
        }
        if (s1 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 8232) {
            s1 = peg$c56;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c57); }
          }
          if (s1 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 8233) {
              s1 = peg$c58;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c59); }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c60();
    }
    s0 = s1;
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c49); }
    }

    return s0;
  }

  function peg$parseSpace() {
    var s0;

    if (peg$c61.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c62); }
    }

    return s0;
  }


    // Instead of encoding all the bad cases into a more complicated regexp lets just add some simple code here
    // Note: We aren't trying to be 100% perfect here, just getting something that works pretty good and pretty quickly
    function goodLink (link) {
      return !link.match(dotDotExp) // disallow 'a...b', but allow /../
    }

    function flatten (input) {
      const result = []
      let strs = []

      function visit(x) {
        if (Array.isArray(x) ) {
          for (const y of x) {
            if (y) {
              visit(y)
            }
          }
        } else if (typeof x === 'string') {
          strs.push(x)
        } else {
          if (strs.length) {
            result.push(strs.join(''))
            strs = []
          }
          result.push(x)
        }
      }

      visit(input)
      if (strs.length) {
        result.push(strs.join(''))
      }
      return result
    }


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};

    module.exports.emojiIndexByChar = emojiIndexByChar
    module.exports.emojiIndexByName = emojiIndexByName

    // quick check to avoid markdown parsing overhead
    // only chars, numbers, whitespace, some common punctuation and periods
    // that end sentences (not domains)
    const plaintextExp = /^([A-Za-z0-9!?=+@#$%^&()[\],'"\s]|\.\B)*$/
    module.exports.isPlainText = function(markdown) {
      return markdown && markdown.match(plaintextExp) ? markdown.trim() : null
    }
  
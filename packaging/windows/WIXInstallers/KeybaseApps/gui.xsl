<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"  xmlns:wix="http://schemas.microsoft.com/wix/2006/wi">
 <xsl:output omit-xml-declaration="yes" indent="yes"/>
 <xsl:template match="node()|@*">
  <xsl:copy>
   <xsl:apply-templates select="node()|@*"/>
  </xsl:copy>
 </xsl:template>  

 <xsl:template match="wix:Directory[@Name='Keybase-win32-ia32']/@Id">
  <xsl:attribute name="Id">GuiDir</xsl:attribute>
 </xsl:template>
 <xsl:template match="wix:Directory[@Name='Keybase-win32-ia32']/@Name">
  <xsl:attribute name="Name">Gui</xsl:attribute>
 </xsl:template>
 <xsl:template match="wix:Directory[@Name='resources']/@Id">
  <xsl:attribute name="Id">GuiResourcesDir</xsl:attribute>
 </xsl:template>
 <xsl:template match="wix:Directory[@Name='shared']/@Id">
  <xsl:attribute name="Id">GuiSharedDir</xsl:attribute>
 </xsl:template>
 
  <xsl:template match="wix:Component">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <wix:RemoveFolder Id="{@Id}" On="uninstall" />
      <xsl:apply-templates select="node()"/>
    </xsl:copy>
  </xsl:template> 
  
</xsl:stylesheet>